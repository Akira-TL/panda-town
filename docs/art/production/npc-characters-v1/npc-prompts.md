# NPC 独立角色图提示词与来源

最终交付15张独立角色图：14名动物居民与1名木质黄铜发条机器人修理师。均使用内置 imagegen 单角色独立生成，PNG原文件直接保存，未裁切、未使用 CLI 抠图。01、04、07使用内置图像编辑清除背景辉光；当前最终图和对应完整提示词见下。用户自行提交 Tripo，本轮不生成或替换三维模型。

除第10名机器人仅按独立提示词生成外，画风参考均为 `docs/art/fairytale-town-reference.png`。所有调用均指定 `transparent_background: true`。

## 01_bakery_rabbit.png｜面包师奶油色兔

- 项目文件：`docs/art/production/npc-characters-v1/01_bakery_rabbit.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-cf0f78fb-d6fb-47e5-aa8a-9a593827fb8c.png`
- 背景编辑的输入原图：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-8a386a63-2517-4d49-93d1-86769917b8c5.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A cream-colored rabbit baker, short plump silhouette, low white chef hat and honey-colored apron.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: high-resolution character source, at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions, adjusted to preserve this species' specified tall/short/slender/broad silhouette.
```

最终背景编辑完整提示词：

```text
Use case: background-extraction. Edit the attached existing character image ONLY to remove every bit of the surrounding colored studio background, golden glow, vignette, haze and ground shadow. Preserve the identical animal character identity, facial features, clothing, pose, proportions, texture, illumination on the body, canvas dimensions and framing. Do not redesign or replace the character. Keep all ears, tail, hands, feet and fine edge fur intact. Every pixel outside the character silhouette must be genuinely transparent alpha=0. No backdrop, no halo, no gradient, no pedestal, no cast shadow. Output one clean complete full-body transparent PNG cutout for single-image-to-3D modeling.
```

## 02_grocery_beaver.png｜木材商棕色河狸

- 项目文件：`docs/art/production/npc-characters-v1/02_grocery_beaver.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-89366a5d-ae00-45b2-a0dd-2e58c8ab9d1f.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A brown beaver lumber merchant with broad shoulders and a thick beaver tail, moss-green work vest, coarse cloth trousers and a secured belt.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: high-resolution character source, at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions, adjusted to preserve this species' specified tall/short/slender/broad silhouette.
```

## 03_market_squirrel.png｜水果商赤褐松鼠

- 项目文件：`docs/art/production/npc-characters-v1/03_market_squirrel.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-b57ffa3e-ba85-4cdf-a5a4-d16d699eb6d9.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A reddish-brown squirrel fruit merchant, fluffy large tail positioned to the side behind the body without obscuring it, golden-yellow top and earthy-red short apron.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: high-resolution character source, at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions, adjusted to preserve this species' specified tall/short/slender/broad silhouette.
```

## 04_research_fox.png｜芯片店技术员赤狐

- 项目文件：`docs/art/production/npc-characters-v1/04_research_fox.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-c0c1da66-4fe7-4013-9480-8d80dd8cc51f.png`
- 背景编辑的输入原图：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-55d5157e-a21d-47aa-baf8-d4cb34515e92.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A tall slender red fox chip-shop technician, cyan-blue short jacket with a small brass chest badge, tail positioned to the side behind the body.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: high-resolution character source, at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions, adjusted to preserve this species' specified tall/short/slender/broad silhouette.
```

最终背景编辑完整提示词：

```text
Use case: background-extraction. Edit the attached existing character image ONLY to remove every bit of the surrounding colored studio background, golden glow, vignette, haze and ground shadow. Preserve the identical animal character identity, facial features, clothing, pose, proportions, texture, illumination on the body, canvas dimensions and framing. Do not redesign or replace the character. Keep all ears, tail, hands, feet and fine edge fur intact. Every pixel outside the character silhouette must be genuinely transparent alpha=0. No backdrop, no halo, no gradient, no pedestal, no cast shadow. Output one clean complete full-body transparent PNG cutout for single-image-to-3D modeling.
```

## 05_bank_owl.png｜金券银行猫头鹰

- 项目文件：`docs/art/production/npc-characters-v1/05_bank_owl.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-700d31ac-2b91-4a1e-a36f-147f071c73cb.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: An anthropomorphic owl gold-voucher banker with a round facial disk, brown and cream feathers, navy vest and gold bow tie; two distinct independent arms and two distinct legs, upright biped.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: high-resolution character source, at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions, adjusted to preserve this species' specified tall/short/slender/broad silhouette. Every pixel outside the character must be transparent alpha=0, with no colored background, no glow/haze/halo, no gradient or ground.
```

## 06_gifts_sheep.png｜花店绵羊

- 项目文件：`docs/art/production/npc-characters-v1/06_gifts_sheep.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-37955b11-be37-4752-86b0-a92b7d48bf11.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A cream curly-fleeced sheep florist, pale-rose short shoulder cape and moss-green apron. Natural sculpted animal wool, not a stuffed toy.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: high-resolution character source, at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions, adjusted to preserve this species' specified tall/short/slender/broad silhouette. Every pixel outside the character must be transparent alpha=0, with no colored background, no glow/haze/halo, no gradient or ground.
```

## 07_rival_otter.png｜咖啡豆商水獭

- 项目文件：`docs/art/production/npc-characters-v1/07_rival_otter.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-d1ba7795-aac7-4a89-8594-eebe27b962b9.png`
- 背景编辑的输入原图：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-1f42104f-1588-451e-bc3a-f45326a67053.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A slender warm-brown otter coffee-bean merchant, ochre-orange apron and deep teal neckerchief.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: high-resolution character source, at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions, adjusted to preserve this species' specified tall/short/slender/broad silhouette. Every pixel outside the character must be transparent alpha=0, with no colored background, no glow/haze/halo, no gradient or ground.
```

最终背景编辑完整提示词：

```text
Use case: background-extraction. Edit attached existing otter character ONLY to remove all surrounding colored studio background, golden glow, vignette, haze and ground shadow. Preserve identical character identity, face, clothes, pose, proportions, texture, body illumination, canvas dimensions and framing. Do not redesign. Keep full tail/hands/feet/edge fur. Every pixel outside character silhouette genuinely transparent alpha=0. No backdrop/halo/gradient/platform/shadow. One clean full-body transparent PNG for single-image-to-3D modeling.
```

## 08_cafe_cat.png｜茶馆姜黄虎斑猫

- 项目文件：`docs/art/production/npc-characters-v1/08_cafe_cat.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-2ddfff65-910f-407c-bc9a-79165b926954.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A ginger tabby cat tea-house host with a rounded face and moderately proportioned body, sage-green short tea-master jacket and cream waist belt.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: high-resolution character source, at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions, adjusted to preserve this species' specified tall/short/slender/broad silhouette. Every pixel outside the character must be transparent alpha=0, with no colored background, no glow/haze/halo, no gradient or ground.
```

## 09_notice_hedgehog.png｜公告管理员刺猬

- 项目文件：`docs/art/production/npc-characters-v1/09_notice_hedgehog.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-8aee0cdc-f962-4ca3-bc03-6c8ab18cd6c8.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A short round brown hedgehog notice administrator, back spines formed as soft thick chunky shapes, gray-blue short postal jacket and a small secured side satchel.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions adjusted to species. Every pixel outside character transparent alpha=0. No glow, vignette, studio backdrop, haze, halo, gradient or ground shadow.
```

## 10_repair_automaton.png｜木质黄铜发条机器人修理师

- 项目文件：`docs/art/production/npc-characters-v1/10_repair_automaton.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-efecb0f5-756b-4bb6-ab04-f90e6da8a781.png`

完整生成提示词：

```text
A single friendly wooden-and-brass clockwork robot resident for a cozy storybook village video game. Rounded compact wooden body, small brass gears at the joints, big kind glass eyes, a little indigo utility vest, two separate articulated arms and two sturdy legs. Full character standing, front slight three-quarter view, empty hands at its sides, complete head and feet with margin, warm polished stylized 3D, genuinely transparent background. No scene, no base, no text.
```

## 11_garden_deer.png｜园丁梅花鹿

- 项目文件：`docs/art/production/npc-characters-v1/11_garden_deer.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-2c433691-ba2d-4d49-9c77-b78db873a931.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A slender spotted sika deer gardener, short sturdy antlers without delicate branching, forest-green smock and sand-colored trousers.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions adjusted to species. Every pixel outside character transparent alpha=0. No glow, vignette, studio backdrop, haze, halo, gradient or ground shadow.
```

## 12_music_frog.png｜乐手青蛙

- 项目文件：`docs/art/production/npc-characters-v1/12_music_frog.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-f85fdae9-25b1-4d2f-b8f4-44741a1ba1d3.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A moss-green frog musician with a wide mouth and large eyes, burgundy vest over a linen shirt, small wooden flute secured at the waist.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions adjusted to species. Every pixel outside character transparent alpha=0. No glow, vignette, studio backdrop, haze, halo, gradient or ground shadow.
```

## 13_dock_turtle.png｜码头看护乌龟

- 项目文件：`docs/art/production/npc-characters-v1/13_dock_turtle.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-9c87a664-8785-4e82-8e46-1d02bf64a8a8.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A short broad olive-green turtle dock keeper with a clear turtle shell, sea-blue short jacket and rope waist belt, two distinct independent anthropomorphic arms and two distinct legs.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions adjusted to species. Every pixel outside character transparent alpha=0. No glow, vignette, studio backdrop, haze, halo, gradient or ground shadow.
```

## 14_riverside_mouse.png｜河岸读者灰鼠

- 项目文件：`docs/art/production/npc-characters-v1/14_riverside_mouse.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-e2922c42-9e0f-478f-9fec-0ac1101b381e.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A small gray mouse riverside reader with large round ears, pale-lavender knitted cardigan and cream trousers, a closed small book satchel secured at the hip.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions adjusted to species. Every pixel outside character transparent alpha=0. No glow, vignette, studio backdrop, haze, halo, gradient or ground shadow.
```

## 15_square_dog.png｜广场向导柯基犬

- 项目文件：`docs/art/production/npc-characters-v1/15_square_dog.png`
- 最终原生成文件：`C:\Users\Akira\.codex\generated_images\01a18fcd-1162-7e10-abbf-1f1a181c854c\exec-150aa018-f8f1-41df-b1c1-cb30ef9a18b4.png`

完整生成提示词：

```text
Use case: stylized-concept.
Asset type: ONE independent full-body character image for single-image-to-3D conversion.
Input image 1 is ONLY the material, warm lighting and refined storybook 3D art-direction reference. Do not include its environment or its characters.
Subject: A golden-brown and white corgi dog square guide, short legs and long torso, teal short shoulder cape, a small secured crossbody satchel and a round compass chest badge.
Pose and anatomy: one anthropomorphic animal character standing upright on TWO legs; two arms separate from the torso, gently angled downward and slightly outward in a relaxed A-pose. Both hands clearly visible and not crossing or covering the torso. Feet apart on the same ground plane. Near frontal view, only about 10 degrees of three-quarter rotation. Entire head, ears, antlers if applicable, tail, both hands and both feet fully visible and uncropped. Nothing held in the hands.
Style: warm fairytale village, refined rounded sculpted 3D forms with softly hand-painted natural surface texture; believable cloth and leather clothing; natural animal fur, feathers, wool or skin as appropriate. Not a plush toy, not a stuffed animal, not felt or crocheted. Friendly calm expression without changing the specified species.
Composition and lighting: single complete character centered, generous clear margin all around, clean easily readable silhouette, neutral soft warm studio light, even material visibility, no harsh shadow on the body.
Background: genuinely transparent alpha, no floor or backdrop and no cast ground shadow.
Hard exclusions: no panda, no extra character, no pedestal/base/platform, no scenery, no text/letters/logo, no large props obscuring body, no multi-view sheet, no collage, no cropped extremities. Small requested accessories must be securely attached at waist/hip/chest and not obscure body anatomy. Preserve the exact requested outfit and species.
Output: at least 1024 pixels on the long side. Approximately three-head-tall game resident proportions adjusted to species. Every pixel outside character transparent alpha=0. No glow, vignette, studio backdrop, haze, halo, gradient or ground shadow.
```
