import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebaseAdmin';

export async function POST(request: Request) {
    try {
    // --- אבטחת מנהל ---
    const body = await request.json().catch(() => ({}));
    if (body.adminPassword !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "פעולה נדחתה: סיסמת מנהל שגויה." }, { status: 401 });
    }

    // 1. מחיקת מסמך התוצאות (זה מה שיחזיר את כל הסטודנטים אוטומטית למסך ההצבעה!)
    await adminDb.collection('results').doc('final').delete();

    // 2. איפוס הסטטוס של כל הקבוצות (מחיקת ההעדפות הקודמות)
    const groupsSnapshot = await adminDb.collection('groups').get();
    const batch = adminDb.batch();
    
    groupsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        preferences: [],
        submitted: false
      });
    });

    await batch.commit();
    return NextResponse.json({ success: true, message: "המערכת אופסה בהצלחה. כולם חזרו למסך ההצבעה." });
  } catch (error: any) {
    console.error("Reset Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}