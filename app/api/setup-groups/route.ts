import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebaseAdmin';

function generateRandomCode(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    // --- אבטחת מנהל ---
    const body = await request.json().catch(() => ({}));
    if (body.adminPassword !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "פעולה נדחתה: סיסמת מנהל שגויה." }, { status: 401 });
    }
    
    const batch = adminDb.batch();
    const generatedCodes: { group: string; code: string }[] = [];
    
    // ניצור 15 קבוצות עם הקידומת MED-
    for (let i = 1; i <= 15; i++) {
      const code = `MED-${generateRandomCode(5)}`; // הנה התוספת!
      const groupRef = adminDb.collection('groups').doc(code);
      
      batch.set(groupRef, {
        name: `קבוצה ${i}`,
        preferences: [],
        submitted: false
      });

      generatedCodes.push({ group: `קבוצה ${i}`, code });
    }
    
    await batch.commit();
    return NextResponse.json({ 
      success: true, 
      message: "15 קבוצות נוצרו בהצלחה (בדוק את ה-Console)!",
      codes: generatedCodes
    });
  } catch (error: any) {
    console.error("Setup Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}