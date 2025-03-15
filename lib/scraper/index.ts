import { chromium, Browser, Page } from "playwright";
import { School, ScrapingResult, ScrapingConfig } from "./types";

export class DiplomeoScraper {
  private browser: Browser | null = null;
  private baseUrl = "https://diplomeo.com";
  private resultsUrl = "https://diplomeo.com/etablissements/resultats";

  /**
   * Initialise le navigateur Playwright
   */
  async init(config?: { headless?: boolean }) {
    this.browser = await chromium.launch({
      headless: config?.headless !== false, // Par défaut à true en production
    });
  }

  /**
   * Ferme le navigateur
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Extrait les écoles de la page de résultats
   */
  async extractSchoolsFromPage(page: Page): Promise<School[]> {
    // Attendre que les résultats soient chargés
    await page.waitForSelector('[data-cy="hub-schools-results"] li');

    // Extraire les infos basiques de chaque école
    return await page.$$eval(
      '[data-cy="hub-schools-results"] li',
      (elements) => {
        return elements.map((el) => {
          // Extraire l'URL de l'école et son ID
          const linkElement = el.querySelector('a[href^="/etablissement-"]');
          const url = linkElement?.getAttribute("href") || "";
          const id = url.split("-").pop()?.split("?")[0] || "";

          // Extraire le nom de l'école
          const name = linkElement?.textContent?.trim() || "";

          // Extraire la ville
          const cityElement = el.querySelector(".tw-font-semibold.md\\:tw-mb-3");
          const city = cityElement?.textContent?.trim() || "";

          // Extraire le type d'école
          const typeElement = el.querySelector(".tw-text-body-xs.tw-font-sans.tw-text-gray-800");
          const type = typeElement?.textContent?.trim() || "";

          // Extraire la note
          const ratingElement = el.querySelector(".tw-text-inherit");
          const rating = ratingElement?.textContent?.trim() || "";

          return {
            id,
            name,
            url: `https://diplomeo.com${url}`,
            city,
            type,
            rating,
          };
        });
      }
    );
  }

  /**
   * Extrait les informations détaillées d'une école
   */
  async extractSchoolDetails(
    page: Page,
    school: School
  ): Promise<School> {
    await page.goto(school.url, { waitUntil: "networkidle" });

    // Attendre que la page soit chargée
    await page.waitForSelector(".blue", { timeout: 10000 }).catch(() => {
      console.log(`Timeout waiting for details on ${school.name}`);
    });

    // Extraire l'email
    const emailLink = await page.$('div[data-l^="xznvygb:"]');
    if (emailLink) {
      const encodedEmail = await emailLink.getAttribute("data-l") || "";
      const email = this.decodeEmail(encodedEmail);
      school.email = email;
    }

    // Extraire le téléphone
    const phoneLink = await page.$('div[data-l^="xgry:"]');
    if (phoneLink) {
      const encodedPhone = await phoneLink.getAttribute("data-l") || "";
      const phone = this.decodeEmail(encodedPhone);
      school.phone = phone;
    }

    // Extraire l'adresse
    const addressLink = await page.$('div[data-l^="x//jjj"]');
    if (addressLink) {
      const addressText = await addressLink.textContent() || "";
      school.address = addressText.includes("Adresse") ? addressText.trim() : undefined;
    }

    // Extraire les secteurs (si disponible)
    const sectors = await page.$$eval(".sector-tag", elements =>
      elements.map(el => el.textContent?.trim() || "")
    ).catch(() => []);

    if (sectors.length > 0) {
      school.sectors = sectors;
    }

    return school;
  }

  /**
   * Décode l'email ou téléphone qui est encodé dans l'attribut data-l
   */
  private decodeEmail(encoded: string): string {
    if (!encoded) return "";

    // Ces URLs sont encodées avec ROT13
    if (encoded.startsWith("xznvygb:")) {
      // Supprimer le préfixe "xznvygb:"
      encoded = encoded.replace("xznvygb:", "");

      // Décoder ROT13
      // eslint-disable-next-line
      return encoded.replace(/[a-zA-Z]/g, function(c : any) {
        return String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
      });
    }

    // Pour les numéros de téléphone
    if (encoded.startsWith("xgry:")) {
      // Supprimer le préfixe "xgry:"
      return encoded.replace("xgry:", "").replace(/f$/, "");
    }

    return encoded;
  }

  /**
   * Récupère le nombre total de pages
   */
  async getTotalPages(page: Page): Promise<number> {
    const paginationText = await page.textContent('.pagination-summary') || "";
    const match = paginationText.match(/(\d+).*?(\d+)/);

    if (match && match[2]) {
      const totalItems = parseInt(match[2], 10);
      // Diplomo affiche 10 résultats par page
      return Math.ceil(totalItems / 10);
    }

    return 1; // Par défaut, au moins une page
  }

  /**
   * Scrape plusieurs pages d'établissements
   */
  async scrapeMultiplePages(
    config: ScrapingConfig = {}
  ): Promise<ScrapingResult> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call init() first.");
    }

    const maxPages = config.maxPages || 3;

    const context = await this.browser.newContext();
    const page = await context.newPage();

    // Accéder à la page de résultats
    await page.goto(this.resultsUrl, { waitUntil: "networkidle" });

    // Récupérer le nombre total de pages
    const totalPages = await this.getTotalPages(page);
    const pagesToScrape = Math.min(totalPages, maxPages);

    console.log(`Found ${totalPages} pages, will scrape ${pagesToScrape} pages`);

    const allSchools: School[] = [];

    // Scraper chaque page
    for (let i = 1; i <= pagesToScrape; i++) {
      console.log(`Scraping page ${i}/${pagesToScrape}`);

      if (i > 1) {
        // Naviguer vers la page suivante
        await page.goto(`${this.resultsUrl}?page=${i}`, { waitUntil: "networkidle" });
      }

      // Extraire les écoles de la page courante
      const schoolsOnPage = await this.extractSchoolsFromPage(page);
      console.log(`Found ${schoolsOnPage.length} schools on page ${i}`);

      // Pour chaque école, aller sur sa page et extraire ses détails
      for (const school of schoolsOnPage) {
        console.log(`Scraping details for ${school.name}`);
        const schoolWithDetails = await this.extractSchoolDetails(page, school);
        allSchools.push(schoolWithDetails);

        // Pause pour éviter de surcharger le serveur
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    await context.close();

    return {
      schools: allSchools,
      timestamp: new Date().toISOString(),
      totalPages,
      totalSchools: allSchools.length,
    };
  }
}