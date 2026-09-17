import { NextResponse } from 'next/server';
import munkres from 'munkres-js';
import { adminDb } from '../../../lib/firebaseAdmin'; 

// הפונקציה הראשית שתטפל בשני סוגי הבקשות
async function handleMatch(request: Request) {
  try {
    // --- בדיקת אבטחה: קרון או מנהל? ---
    const authHeader = request.headers.get('authorization');
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    // אם זה לא הקרון של Vercel, אנחנו מצפים שזה יהיה מנהל עם סיסמה (POST בלבד)
    if (!isVercelCron) {
      if (request.method !== 'POST') {
         return NextResponse.json({ error: "פעולה נדחתה: חסר טוקן של קרון או ששיטת הבקשה שגויה." }, { status: 401 });
      }
      
      const body = await request.json().catch(() => ({}));
      if (body.adminPassword !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: "פעולה נדחתה: סיסמת מנהל שגויה." }, { status: 401 });
      }
    }
    
    // --- 1. שליפת כל הקבוצות ממסד הנתונים ---
    const groupsSnapshot = await adminDb.collection('groups').get();
    const groups = groupsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    const count = groups.length;

    if (count === 0) {
      return NextResponse.json(
        { error: "לא נמצאו קבוצות במסד הנתונים." }, 
        { status: 400 }
      );
    }

    groups.sort((a, b) => a.id.localeCompare(b.id));

    // --- 2. בניית מטריצת העלויות ---
    const costMatrix: number[][] = [];
    for (let i = 0; i < count; i++) {
      const row: number[] = [];
      const prefs = groups[i].preferences || []; 
      for (let j = 0; j < count; j++) {
        const trackNumber = j + 2; 
        const rankIndex = prefs.indexOf(trackNumber);
        const rank = rankIndex === -1 ? 100 : rankIndex + 1;
        row.push(rank * rank); 
      }
      costMatrix.push(row);
    }

    // --- 3. הרצת האלגוריתם ההונגרי ---
    const indices = munkres(costMatrix);

    // --- 4. פענוח התוצאות ---
    const assignments = indices.map((pair: any) => {
      const groupIndex = pair[0];
      const trackIndex = pair[1];
      const group = groups[groupIndex];
      const trackNumber = trackIndex + 2;
      
      const penalty = costMatrix[groupIndex][trackIndex];
      const preferenceReceived = penalty === 10000 ? -1 : Math.sqrt(penalty);

      return {
        groupId: group.id,
        groupName: group.name || `קבוצה ${groupIndex + 1}`,
        assignedTrack: `מסלול ${trackNumber}`,
        preferenceReceived: preferenceReceived
      };
    });

    // --- 5. שמירת התוצאות הסופיות ---
    await adminDb.collection('results').doc('final').set({
      assignments: assignments,
      calculatedAt: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      message: `השיבוץ הושלם בהצלחה עבור ${count} קבוצות! (מסלולים 2-16)`,
      assignments 
    });

  } catch (error: any) {
    console.error("Algorithm Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ניתוב של GET (עבור Vercel Cron)
export async function GET(request: Request) {
  return handleMatch(request);
}

// ניתוב של POST (עבור כפתור המנהל)
export async function POST(request: Request) {
  return handleMatch(request);
}