import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env variables
config();
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ ERREUR: GEMINI_API_KEY introuvable dans le fichier .env");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const CATALOG_FILE = path.join(process.cwd(), 'knowledge-catalog.json');

const VALID_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx', '.doc'];

async function main() {
    console.log("\n🕵️‍♂️ AUDIT COMPLET : LOCAL vs GEMINI\n");

    // 1. Scan Local Files
    console.log("📂 1. Scan du dossier local 'knowledge'...");
    const localFiles = new Map<string, string>(); // displayName -> absolutePath

    if (!fs.existsSync(KNOWLEDGE_DIR)) {
        console.warn(`⚠️  Le dossier ${KNOWLEDGE_DIR} n'existe pas. Création automatique...`);
        fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }

    const walkDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (file.startsWith('.') || file.startsWith('~$')) continue;

            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walkDir(fullPath);
            } else {
                const ext = path.extname(file).toLowerCase();
                if (VALID_EXTENSIONS.includes(ext)) {
                    // Use filename as unique display name in Gemini
                    localFiles.set(file, fullPath);
                }
            }
        }
    };

    walkDir(KNOWLEDGE_DIR);
    console.log(`   => ${localFiles.size} documents éligibles trouvés en local.\n`);

    // 2. Scan Gemini Files
    console.log("☁️  2. Scan du stockage Gemini...");
    const geminiFiles = new Map<string, any>(); // displayName -> file object

    try {
        const response: any = await ai.files.list();
        for await (const f of response) {
            if (f && f.displayName) {
                geminiFiles.set(f.displayName, f);
            }
        }
        console.log(`   => ${geminiFiles.size} documents actifs trouvés sur Gemini.\n`);
    } catch (e: any) {
        console.error(`❌ Erreur de récupération des fichiers Gemini : ${e.message}`);
        process.exit(1);
    }

    // 3. Compare & Upload
    console.log("⚖️  3. Synchronisation...");
    const catalogData: { filename: string, uri: string, mimeType: string, name: string }[] = [];
    let uploadedCount = 0;

    for (const [filename, fullPath] of localFiles.entries()) {
        if (geminiFiles.has(filename)) {
            const gFile = geminiFiles.get(filename);
            catalogData.push({
                filename,
                uri: gFile.uri,
                name: gFile.name,
                mimeType: gFile.mimeType || "application/pdf"
            });
            console.log(`   ✅ Déjà en ligne : ${filename}`);
        } else {
            console.log(`   📤 Upload de : ${filename}...`);
            try {
                // Determine mime type roughly
                let mimeType = 'text/plain';
                if (filename.endsWith('.pdf')) mimeType = 'application/pdf';

                const uploadedFile: any = await ai.files.upload({
                    file: fullPath,
                    config: {
                        mimeType: mimeType,
                        displayName: filename
                    }
                });

                console.log(`      ⏳ En attente du traitement complet...`);
                let state = uploadedFile.state;
                let currentFile = uploadedFile;

                // Wait for the file to be processed
                while (state === 'PROCESSING') {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    currentFile = (await ai.files.get({ name: uploadedFile.name })) as any;
                    state = currentFile.state;
                }

                if (state === 'FAILED') {
                    console.error(`      ❌ Échec du traitement de ${filename} côté Gemini.`);
                } else {
                    console.log(`      ✨ Upload et traitement réussis ! (URI: ${currentFile.uri})`);
                    catalogData.push({
                        filename,
                        uri: currentFile.uri!,
                        name: currentFile.name!,
                        mimeType: currentFile.mimeType!
                    });
                    uploadedCount++;
                }
            } catch (err: any) {
                console.error(`      ❌ Erreur d'upload pour ${filename}: ${err.message}`);
            }
        }
    }

    // 4. Update the Catalog
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalogData, null, 2), 'utf-8');

    console.log("\n" + "-".repeat(60));
    console.log(`✅ Fichiers synchronisés aujourd'hui : ${uploadedCount}`);
    console.log(`📁 Total des fichiers dans le catalogue : ${catalogData.length}`);
    console.log("Le fichier 'knowledge-catalog.json' a été mis à jour.");
    console.log("-".repeat(60) + "\n");
}

main().catch(console.error);
