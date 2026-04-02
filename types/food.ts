/** Age range for context-aware advice (optional). */
export type AgeRange = "under-18" | "18-30" | "31-50" | "51-64" | "65-plus";

/** Activity level for context-aware advice (optional). */
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";

/** Optional daily nutrient goals (e.g. max sodium in mg). */
export interface NutrientGoals {
  sodiumMgMax?: number;
  sugarGMax?: number;
  caloriesKcalMax?: number;
}

/**
 * Open Food Facts country tag (e.g. "en:united-states") for location-based product suggestions.
 */
export type CountryCode = string;

/**
 * User health profile stored locally and used for personalized risk computation.
 */
export interface HealthProfile {
  conditions: string[];
  allergies: string[];
  dietaryPreferences: string[];
  medications?: string[];
  goals: string[];
  ageRange?: AgeRange;
  activityLevel?: ActivityLevel;
  nutrientGoals?: NutrientGoals;
  /** Country/region for showing most common brands in that location (OFF tag e.g. "en:united-states"). */
  countryCode?: CountryCode;
}

/**
 * Empty profile for initial state.
 */
export const EMPTY_HEALTH_PROFILE: HealthProfile = {
  conditions: [],
  allergies: [],
  dietaryPreferences: [],
  medications: [],
  goals: [],
};

/** Meal context when logging a scan (optional). */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";

/**
 * Nutriments from Open Food Facts (per 100g or per serving).
 */
export interface Nutriments {
  energy?: number; // kcal per 100g
  energy_serving?: number;
  proteins?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sodium?: number; // mg
  sodium_serving?: number;
  sugars?: number;
  sugars_serving?: number;
  "energy-kcal_100g"?: number;
  "proteins_100g"?: number;
  "carbohydrates_100g"?: number;
  "fat_100g"?: number;
  "fiber_100g"?: number;
  "sodium_100g"?: number;
  "sugars_100g"?: number;
}

/**
 * Product from Open Food Facts API (normalized for app use).
 */
export interface ProductResult {
  code: string; // barcode
  product_name: string;
  product_name_en?: string;
  generic_name?: string;
  generic_name_en?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  ingredients_tags?: string[];
  nutriments?: Nutriments;
  serving_size?: string;
  additives_tags?: string[];
  additives_n?: number;
  allergens_tags?: string[];
  allergens_from_ingredients?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  categories_tags?: string[];
  countries_tags?: string[];
  image_url?: string;
  image_small_url?: string;
}

export type RiskSeverity = "critical" | "warning" | "info" | "good";

/**
 * Source of the scan/analysis.
 */
export type ScanSource = "barcode" | "photo" | "search" | "label";

/**
 * Single health risk or insight.
 */
export interface HealthRisk {
  severity: RiskSeverity;
  category: string;
  message: string;
}

export type DietType =
  | "vegan"
  | "vegetarian"
  | "halal"
  | "keto"
  | "gluten-free"
  | "dairy-free"
  | "low-sodium"
  | "low-sugar";

export interface DietCompatibilityResult {
  diet: DietType;
  compatible: boolean;
  reason?: string;
}

export interface Subscores {
  /** How well the product matches allergen safety for the profile (higher = safer; critical allergy hit → very low). */
  allergens: number; // 0-100
  nutrition: number; // 0-100
  additives: number; // 0-100 (higher = fewer additive concerns)
  processing: number; // 0-100 (higher = less ultra-processed)
  dietFit: number; // 0-100
}

export interface ScoreDriver {
  label: string;
  impact: number; // negative = worse, positive = better
  detail: string;
}

export type UltraProcessedLabel = "low" | "moderate" | "high" | "ultra";

export interface UltraProcessedScore {
  score: number; // 0-100
  label: UltraProcessedLabel;
  rationale: string;
}

export interface SynergyWarning {
  title: string;
  details: string;
  confidence: "low" | "medium" | "high";
}

export type RegulationStatus = "allowed" | "restricted" | "banned" | "unknown";
export type RegionCode = "US" | "EU" | "UK" | "CA";

export interface RegulationComparison {
  ingredientKey: string;
  displayName: string;
  statusByRegion: Record<RegionCode, RegulationStatus>;
  note?: string;
}

export interface ProductAnalysis {
  overallScore: number; // 0-100
  overallLabel: "excellent" | "good" | "caution" | "avoid";
  subscores: Subscores;
  drivers: ScoreDriver[];
  ultraProcessed: UltraProcessedScore;
  dietCompatibility: DietCompatibilityResult[];
  synergyWarnings: SynergyWarning[];
  regulationComparisons: RegulationComparison[];
  healthRisks: HealthRisk[];
}

/**
 * Saved scan/analysis result (includes product snapshot and computed risks).
 */
export interface ScanResult {
  id: string;
  timestamp: number;
  source: ScanSource;
  barcode?: string;
  product: ProductResult;
  healthRisks: HealthRisk[];
  analysis?: ProductAnalysis;
  /** Optional meal context (breakfast, lunch, etc.). */
  mealType?: MealType;
}

/**
 * Ingredient explanation for complex/chemical ingredients.
 */
export interface IngredientDetail {
  name: string;
  plainDescription: string;
  typicalUse: string;
  healthConsideration: string;
  learnMoreUrl?: string;
}
