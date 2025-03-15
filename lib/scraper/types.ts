export interface School {
  id: string;
  name: string;
  url: string;
  city?: string;
  type?: string;
  rating?: string;
  email?: string;
  phone?: string;
  address?: string;
  sectors?: string[];
}

export interface ScrapingResult {
  schools: School[];
  timestamp: string;
  totalPages?: number;
  totalSchools?: number;
}

export interface ScrapingConfig {
  maxPages?: number;
  headless?: boolean;
}