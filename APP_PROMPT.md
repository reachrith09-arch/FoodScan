# App Build Prompt: Food & Barcode Health Insights

Use this prompt to build a mobile app that analyzes food (by photo or barcode) and gives personalized health risks and insights based on the user’s health profile.

---

## App Overview

Build a **modern mobile app** (React Native / iOS or your preferred stack) that lets users:

1. **Capture food** via camera (photo of the dish/package) or **scan a barcode**.
2. **Get personalized health risks and insights** for that product, based on **health info the user has already entered** in the app.
3. Explore **ingredient details** (especially complex/chemical-sounding ingredients) and related nutrition/health features in a clean, multi-page UI.

---

## Core Features

### 1. User Health Profile (Required Before Insights)

- **Dedicated “Health Profile” or “My Health” page/screen** where the user can input and edit:
  - **Conditions / diagnoses** (e.g., diabetes, hypertension, celiac, heart disease, kidney disease, allergies).
  - **Allergies** (nuts, dairy, gluten, shellfish, etc.).
  - **Dietary preferences** (vegetarian, vegan, halal, kosher, low-sodium, low-sugar, etc.).
  - **Medications** (optional but useful for interactions, e.g., blood thinners, MAOIs).
  - **Goals** (weight loss, muscle gain, blood sugar control, heart health, etc.).
- Profile should be **saved locally** (and optionally synced) and **editable anytime**.
- The app must **require** that at least some basic health info (e.g., allergies and/or one condition or goal) is set before showing “health risks” or “insights”; otherwise show a friendly prompt to complete the profile.

### 2. Food Input: Photo and Barcode

- **Photo flow**
  - Camera or gallery to take/select a photo of:
    - A **plate of food** (identify dish/ingredients where possible), or
    - A **food package / label** (to read ingredients and nutrition).
  - After capture, the app should **identify the food** (or extract text from label) and then run health analysis.
- **Barcode flow**
  - Scan product barcode (UPC/EAN).
  - Look up product in a database (e.g., Open Food Facts or similar API) to get:
    - Product name, brand, ingredients list, nutrition facts.
  - Run the same health-risk and insight logic as for photo-based input.
- **Unified “Analyze” experience**: whether the user used photo or barcode, show results in the same format: product/food name, ingredients, nutrition summary, and **personalized health risks and insights**.

### 3. Health Risks and Insights (Personalized)

- For each analyzed food/product, show **personalized** output based on the user’s health profile, for example:
  - **Allergy warnings** (e.g., “Contains tree nuts”).
  - **Condition-related risks** (e.g., “High sodium – caution if you have hypertension”; “High sugar – consider if managing diabetes”).
  - **Ingredient interactions** (e.g., “Contains tyramine – caution with MAOI medications” if you support medications).
  - **Dietary fit** (e.g., “Not vegan – contains dairy”; “Contains gluten”).
  - **Goal alignment** (e.g., “High in added sugar for weight loss”; “Good protein for muscle gain”).
- Present risks in a clear, scannable way (e.g., severity or category: Critical / Warning / Info / Good).

### 4. Ingredient Information (Complex Ingredients)

- **Ingredient list** for the product/food (from barcode API or from label/photo OCR).
- **“Complex” or unfamiliar ingredients** (e.g., long chemical names, additives, preservatives):
  - **Explain in plain language** what the ingredient is (e.g., “Emulsifier that keeps oil and water mixed”).
  - **Typical use** (e.g., “Common in processed snacks and dressings”).
  - **Health considerations** (e.g., “Generally recognized as safe; some people prefer to avoid” or “May cause sensitivity in some individuals”).
- Allow **tap/expand** on an ingredient to see this detail (either in-page or on a dedicated ingredient-detail screen).
- Optionally support a **“Learn more”** link to a trusted source (e.g., official or academic) when available.

### 5. Other Similar Features to Include

- **Nutrition summary**: calories, macronutrients (protein, carbs, fat), fiber, sodium, sugar (per serving if available).
- **Serving size** and **number of servings** for the product when available.
- **History / Recent scans**: list of recently analyzed foods (photo or barcode) so the user can revisit results.
- **Favorites / Saved items**: save products for quick re-check or comparison.
- **Search**: search by product name or brand (using the same database as barcode) and run the same health analysis.
- **Comparison** (optional): compare two products side-by-side (e.g., two brands of the same item) for nutrition and risks.
- **Tips / Education**: short tips on reading labels, understanding additives, or matching food to conditions (e.g., “What to watch for with diabetes”).

---

## Design and UX

- **Modern UI**:
  - Clean layout, consistent spacing, readable typography.
  - Use a cohesive color system (e.g., green for “safe/good”, amber for “caution”, red for “avoid/critical” where appropriate).
  - Subtle use of cards, sections, and hierarchy so screens don’t feel cluttered.
- **Multiple pages** the user can toggle between, for example:
  - **Home / Scan**: main entry – “Scan barcode” or “Take photo” with quick access to recent/favorites.
  - **Results**: after scan/photo – product name, nutrition summary, health risks, ingredient list with expandable details.
  - **Health Profile / My Health**: input and edit conditions, allergies, medications, goals.
  - **History**: list of past analyses with tap-through to see past results again.
  - **Favorites / Saved**: saved products and quick re-analyze.
  - **Search**: search products and run analysis.
  - **Settings**: units (metric/imperial), notifications, data privacy, about/credits.
- **Navigation**: bottom tab bar or drawer so users can switch between **Scan**, **History**, **Profile**, and **Settings** (or equivalent) without losing context.
- **Accessibility**: support dynamic type, sufficient contrast, and clear labels for buttons and links.

---

## Technical Suggestions

- **Barcode / product data**: use **Open Food Facts** API (or similar) for barcode lookup and ingredients/nutrition.
- **Image recognition**: use a **vision API** (e.g., Google Cloud Vision, AWS Rekognition, or a food-specific ML API) for dish recognition or OCR of labels; fallback to manual “enter product name” if needed.
- **Ingredient explanations**: use a curated list or API for common additives and complex ingredients (e.g., E-numbers, common chemical names) with short, user-friendly descriptions and health notes.
- **Storage**: store health profile and optionally history/favorites locally (e.g., AsyncStorage / UserDefaults); consider optional cloud sync for multi-device.
- **Offline**: where possible, cache recent results and show basic “last analyzed” info when offline; require network for new barcode/photo analysis.

---

## Summary Checklist for the AI

- [ ] User health profile page (conditions, allergies, meds, goals) – required before full insights.
- [ ] Photo capture (dish or package) and barcode scan as input methods.
- [ ] Personalized health risks and insights based on profile (allergies, conditions, goals).
- [ ] Full ingredient list with **expandable explanations for complex/chemical ingredients**.
- [ ] Nutrition summary (calories, macros, sodium, sugar, etc.) and serving info.
- [ ] History of scans and optional Favorites.
- [ ] Search by product name with same analysis.
- [ ] Modern, multi-page UI with clear navigation (tabs or drawer).
- [ ] Consistent visual language (colors, typography, spacing) and accessibility basics.

Use this prompt to generate the app structure, screens, and logic; adjust tech stack and APIs to match the target platform (e.g., React Native for this starter iOS app).
