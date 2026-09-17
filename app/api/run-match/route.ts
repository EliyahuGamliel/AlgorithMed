import { NextResponse } from 'next/server';
import munkres from 'munkres-js';
import { adminDb } from '../../../lib/firebaseAdmin'; 

export async function POST(request: Request) {
  try {

    // --- אבטחת מנהל + תמיכה ב-Cron אוטומטי ---
    const authHeader = request.headers.get('authorization');
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;


    // --- אבטחת מנהל ---
    if (!isVercelCron) {
      const body = await request.json().catch(() => ({}));
      if (body.adminPassword !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: "פעולה נדחתה: סיסמת מנהל שגויה." }, { status: 401 });
      }
    }
    
    // 1. שליפת כל הקבוצות ממסד הנתונים
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

    // נסדר את הקבוצות אלפביתית לפי ה-ID שלהן כדי שיהיה סדר קבוע למטריצה
    groups.sort((a, b) => a.id.localeCompare(b.id));

    // 2. בניית מטריצת העלויות (Cost Matrix) בגודל דינאמי לפי מספר הקבוצות בפועל (count x count)
    const costMatrix: number[][] = [];
    
    for (let i = 0; i < count; i++) {
      const row: number[] = [];
      const prefs = groups[i].preferences || []; 

      for (let j = 0; j < count; j++) {
        // שינוי קריטי: המסלולים ממוספרים מ-2 עד 16!
        const trackNumber = j + 2; 
        const rankIndex = prefs.indexOf(trackNumber);
        
        // אם קבוצה לא דירגה מסלול מסוים, ניתן קנס גבוה
        const rank = rankIndex === -1 ? 100 : rankIndex + 1;
        
        // קנס ריבועי לשמירה על הוגנות
        row.push(rank * rank); 
      }
      costMatrix.push(row);
    }

    // 3. הרצת האלגוריתם ההונגרי
    const indices = munkres(costMatrix);

    // 4. פענוח התוצאות לפורמט קריא
    const assignments = indices.map((pair: any) => {
      const groupIndex = pair[0];
      const trackIndex = pair[1];
      
      const group = groups[groupIndex];
      
      // שינוי קריטי: המסלול ששובץ הוא האינדקס ועוד 2
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

    // 5. שמירת התוצאות הסופיות ב-Firebase
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