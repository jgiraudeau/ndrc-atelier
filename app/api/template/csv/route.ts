import { NextResponse } from 'next/server';

export async function GET() {
    // Contenu simple et propre
    const content = "Nom,Prénom,CodeClasse,PIN\nDupont,Thomas,NDRC1,1234\nMartin,Sophie,NDRC2,5678";

    // Ajout du BOM (\uFEFF) pour Excel
    const encoder = new TextEncoder();
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const encodedContent = encoder.encode(content);

    // Construire le blob final avec BOM + Contenu
    const finalBuffer = new Uint8Array(bom.length + encodedContent.length);
    finalBuffer.set(bom);
    finalBuffer.set(encodedContent, bom.length);

    return new NextResponse(finalBuffer, {
        headers: {
            'Content-Type': 'application/octet-stream', // Force le téléchargement binaire
            'Content-Disposition': 'attachment; filename="modele_import_eleves.csv"',
            'Cache-Control': 'no-store, max-age=0', // Évite le cache navigateur
        },
    });
}
