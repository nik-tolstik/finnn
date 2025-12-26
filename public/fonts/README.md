# Onest Font Files

Place Onest font files here in the following format:

- Onest-Thin.woff2 (weight: 100)
- Onest-Light.woff2 (weight: 300)
- Onest-Regular.woff2 (weight: 400)
- Onest-Medium.woff2 (weight: 500)
- Onest-Bold.woff2 (weight: 700)
- Onest-ExtraBold.woff2 (weight: 800)
- Onest-Black.woff2 (weight: 900)

## How to add the font:

1. Download the Onest font from:
   - GitHub: https://github.com/andrewkudryavtsev/Onest
   - Official website: https://onest.md/

2. Extract the font files and convert them to WOFF2 format if needed

3. Place the WOFF2 files in this directory (`public/fonts/`)

4. The font will be automatically loaded via CSS @font-face declarations in `globals.css`

**Note:** If font files are not present, the app will use system fallback fonts.

