# Launcher artwork

`ui/thanos.png` is the Thanos / Infinity Gauntlet image supplied by the repository owner for the launcher. It is copied unchanged from the supplied attachment; cropping and contrast overlays are applied only by the UI stylesheet. It replaces the generated island artwork in the home and Setup screens. No image-generation tool was used for this replacement.

## Season 4 redesign

The owner requested Season 4 images from the internet. These bundled images are loaded locally (the renderer does not contact image hosts):

- `ui/art/season4-showdown.jpg`: Carbide/Omega Season 4 promotional artwork, [PC Gamer article](https://www.pcgamer.com/this-player-made-fortnite-superhero-film-is-awesome/), [original image](https://cdn.mos.cms.futurecdn.net/MHv37SVffvjJeCrokbtArD.jpg).
- `ui/art/season4.jpg`: Season 4 thumbnail, [Xbox Wire, May 1, 2018](https://news.xbox.com/en-us/2018/05/01/fortnite-season-4-starts-now-xbox-one/), [original image](https://xboxwire.thesourcemediaassets.com/sites/2/Fortnite_Season4_Thumb-small.jpg).
- `ui/art/hop-rocks.jpg`: Hop Rocks promotional artwork from the same Xbox Wire article, [original image](https://xboxwire.thesourcemediaassets.com/sites/2/BR04_Social_HopRocks.jpg).
- `ui/art/thanos-gauntlet.jpg`: original Fortnite × Avengers Infinity Gauntlet promotional artwork with Omega and Thanos, used for the ordinary Thanos mode. [Epic Games announcement](https://www.fortnite.com/news/infinity-gauntlet?lang=en-US), [original image](https://cdn2.unrealengine.com/Fortnite%2FEN_BR04_Social_InfinityGauntletLTM-1000x1000-de9fc2264b73dc191be2435b3e80bdff4bbdfc8a.jpg). Separate from the Infinity Showdown artwork.

Fortnite artwork belongs to its respective rights holders; these sources are attribution, not a claim of a new redistribution license. Images are stored unchanged and cropped using CSS.

`ui/logo.svg` is an original geometric portal and falling-shard logo. It does not copy Project Rift's logo. `scripts/create-icon.mjs` renders the matching Windows PNG/ICO without a font dependency.
