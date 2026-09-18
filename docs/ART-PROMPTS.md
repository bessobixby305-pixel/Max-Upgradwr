# Промпты для генерации артов

24 картинки: 11 режимов, 12 кейсов и баннер. Кладутся в `public/art/`
под теми именами, что указаны в заголовках. Файла нет — плитка
показывает эмодзи, ничего не ломается.

## Требования к файлам

- WebP или PNG, 512×512 (баннер 900×900)
- **Сплошной чёрный фон**, не прозрачность
- Объект по центру, занимает ~70% кадра
- До 150 КБ

## Почему чёрный фон, а не прозрачный

На запрос прозрачного фона модель рисует шашечку пикселями — настоящего
альфа-канала в файле нет, а свечение запекается поверх этой шашечки и
чисто не отделяется. Плитки в приложении тёмные, поэтому чёрный фон
растворяется в подложке и ничего вырезать не нужно.

Обязательно оставляй в промпте явный запрет `no checkerboard, no
transparency grid` — без него модель почти всегда рисует клетки.

---

## Режимы

### 1. `game-upgrade.webp` — Апгрейд

```
3D rendered mobile game icon: a glowing upward-pointing chevron arrow made of brushed metal with a violet energy core, floating above a small hexagonal platform. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with violet #A855F7 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 2. `game-cases.webp` — Кейсы

```
3D rendered mobile game icon: a closed sci-fi loot crate, dark metal body with reinforced corners and a magenta glowing seam along the lid. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with magenta #F0468C neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 3. `game-mines.webp` — Мины

```
3D rendered mobile game icon: a round cartoon bomb, matte black sphere with a short burning fuse throwing green sparks. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with green #3DD68C neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 4. `game-crash.webp` — Краш

```
3D rendered mobile game icon: a stylized retro rocket tilted 45 degrees upward, white and orange hull with fins, bright exhaust flame trailing behind. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with orange #FF9A2E neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 5. `game-contract.webp` — Контракт

```
3D rendered mobile game icon: an industrial hydraulic press machine, blue painted steel frame with a heavy descending piston compressing a glowing cube. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with violet-blue #7C5CFF neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 6. `game-battle.webp` — Битва кейсов

```
3D rendered mobile game icon: two identical dark metal loot crates facing each other, a bright blue lightning bolt cracking in the gap between them. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with blue #3B82F6 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 7. `game-double.webp` — Дабл

```
3D rendered mobile game icon: a casino roulette wheel seen at an angle, alternating red and black segments with one green segment, a single chip resting on the rim. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with red #FF4D4D neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 8. `game-dice.webp` — Кости

```
3D rendered mobile game icon: two white casino dice mid-tumble, rounded corners, deep pip indentations, one resting and one tilted in the air. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with teal #00D3C7 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 9. `game-tower.webp` — Башня

```
3D rendered mobile game icon: a tower of five stacked glossy blocks narrowing toward the top, slightly offset like an unstable stack, faint violet energy glowing between the layers. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with lilac #8B6BFF neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 10. `game-slots.webp` — Слоты

```
3D rendered mobile game icon: a compact slot machine front with three reels showing lucky seven symbols, chrome frame and a red side lever. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with golden #FFC53D neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 11. `game-jackpot.webp` — Джекпот

```
3D rendered mobile game icon: a heavy bank vault door slightly ajar with golden coins spilling out of the opening and piling at its base. Isometric three-quarter view, centered single object, glossy plastic and metal materials, soft studio lighting with lime #A3E635 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

## Кейсы

У всех одинаковый силуэт контейнера — меняется только отделка.

### 12. `case-starter.webp` — Стартовый (60 MX)

```
3D rendered mobile game icon: a plain cardboard shipping box with taped seams and slightly worn corners, closed lid. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with cool grey #9AA3B2 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 13. `case-emoji.webp` — Эмодзи (130 MX)

```
3D rendered mobile game icon: a closed glossy loot crate in warm yellow plastic, rounded smiley face emblems embossed on its side panels. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with yellow #FFC53D neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 14. `case-stickers.webp` — Стикерпак (300 MX)

```
3D rendered mobile game icon: a closed loot crate in blue plastic, covered with colorful peeling vinyl stickers of abstract shapes. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with blue #3B82F6 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 15. `case-gifts.webp` — Подарочный (690 MX)

```
3D rendered mobile game icon: a closed loot crate wrapped like a present, glossy pink surface with a satin ribbon and a large bow on the lid. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with pink #F0468C neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 16. `case-night.webp` — Ночной (1 410 MX)

```
3D rendered mobile game icon: a closed matte black tactical crate with a thin cyan light strip glowing along the lid seam and small recessed latches. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with graphite #6B7280 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 17. `case-premium.webp` — Премиум (4 500 MX)

```
3D rendered mobile game icon: a closed dark purple loot crate with a large faceted diamond crystal embedded in the center of its lid, glowing softly from within. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with violet #A855F7 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 18. `case-channel.webp` — Канал (9 900 MX)

```
3D rendered mobile game icon: a closed magenta loot crate with a chrome megaphone speaker mounted on its lid, small broadcast waves etched into the side. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with magenta #F0468C neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 19. `case-admin.webp` — Админский (21 400 MX)

```
3D rendered mobile game icon: a closed armored military crate with riveted steel plating and a raised emerald shield emblem on the lid. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with green #3DD68C neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 20. `case-space.webp` — Космос (56 600 MX)

```
3D rendered mobile game icon: a closed futuristic capsule crate with rounded white ceramic panels, glowing indigo seams and tiny star sparkles drifting around it. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with indigo #7C5CFF neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 21. `case-legend.webp` — Легендарный (145 000 MX)

```
3D rendered mobile game icon: a closed ornate golden crate with engraved filigree patterns and a small jeweled crown resting on top of the lid. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with warm gold #FFC53D neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 22. `case-mythic.webp` — Мифический (510 000 MX)

```
3D rendered mobile game icon: a closed obsidian crate whose lid seams leak swirling galaxy nebula light in crimson and violet, tiny stars escaping upward. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with crimson #F0468C neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

### 23. `case-divine.webp` — Божественный (1 270 000 MX)

```
3D rendered mobile game icon: a closed luminous white crate made of translucent crystal, a floating ornate golden key hovering just above its lid, radiant turquoise light pouring from the seams. Isometric three-quarter view, centered single object, glossy materials, soft studio lighting with turquoise #00D3C7 neon rim light, subtle soft shadow beneath. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no gradient, no vignette, no floor, no scenery. Square 1:1 composition, object centered, filling about 70% of the frame. No text, no logos, no watermark. Clean high-detail game asset.
```

## Баннер

### 24. `hero.webp` — 900×900

```
3D rendered game key art: an open sci-fi loot crate bursting with light, golden coins, gems and small prize items flying upward out of it in a dynamic spray. Dramatic three-quarter view, composition weighted to the right side so the left third stays empty for text. Violet and blue neon lighting, glossy metal and gold materials, volumetric glow. Solid pure black background (#000000), completely flat and matte — no checkerboard, no transparency grid, no pattern, no vignette. Square 1:1 composition. No text, no logos, no watermark, no characters.
```

## Если картинки выходят разными по форме

Возьми одну удачную и в следующих промптах добавляй:
`same crate silhouette as the previous image, only the finish changes`.

Генерируй по одной за запрос — пачкой модель разводит их стилистически.
