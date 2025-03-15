import { NextRequest, NextResponse } from "next/server";
import { DiplomeoScraper } from "../../../../lib/scraper";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    // Récupérer les paramètres de la requête
    const body = await req.json();
    const { maxPages = 3, headless = true } = body;

    // Initialiser le scraper
    const scraper = new DiplomeoScraper();
    await scraper.init({ headless });

    // Exécuter le scraping
    const result = await scraper.scrapeMultiplePages({ maxPages });

    // Fermer le navigateur
    await scraper.close();

    // Enregistrer les résultats dans un fichier JSON
    const resultDir = path.join(process.cwd(), "public", "results");

    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `diplomeo-results-${timestamp}.json`;
    const outputPath = path.join(resultDir, filename);

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      message: "Scraping completed successfully",
      stats: {
        totalSchools: result.schools.length,
        totalPages: result.totalPages,
        scrapedPages: Math.min(result.totalPages || 0, maxPages),
      },
      downloadUrl: `/results/${filename}`,
    });
  } catch (error) {
    console.error("Scraping error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "An error occurred during scraping",
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}