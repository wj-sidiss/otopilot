# Assets and licences

The pictures in this kit are built with code, and a long factual film adds real material where code cannot show the real thing (archive photos and footage, stock photos and videos); the sound is usually a recorded score and ready-made effects (Kenney CC0 through `sounds.py`, `sound.md` §5), with code sound where it fits better or when the film is synthetic by choice. Every outside file (a recording, a sound, a texture, an HDRI sky, an archive image) comes from open-licence sources and is logged the moment it arrives.

## 1. Two kinds of reference

| Kind | Use | Allowed sources |
|---|---|---|
| **Mood** | studied for look, light, colour, framing; never in frames | anything the user shares or links, including copyrighted films and images |
| **Material** | appears in the film (texture, plate, recording) | open licence only: CC0, public domain, CC BY, CC BY-SA (with attribution), and the Pixabay Content License for stock photos and videos |

The user's own references go into `refs/` (images) and `refs/links.txt` (links, film titles with timestamps). Never ask for passwords or log into anything.

## 2. Searching (no browser; only Pixabay takes a key)

```bash
python3 tools/asset_search.py search --q "<a sound>" --type sound --out research/<sound>
python3 tools/asset_search.py search --q "<a subject>" --out research/<subject>           # wikimedia, aic, cleveland, nasa, pixabay
python3 tools/asset_search.py search --q "<what and where>" --type video --out research/<clip> # pixabay, wikimedia, archive
python3 tools/asset_search.py search --q "<a sky or a room>" --type hdri --out research/hdri # polyhaven
python3 tools/asset_search.py search --q "<subject>" --sources met,cleveland --out research/<subject>
python3 tools/asset_search.py fetch --results research/<sound>/results.json --pick 2 --dest assets/sound
```

| Source | Gives | Licence |
|---|---|---|
| Pixabay | stock photos and videos (`--type image`, `--type video`) | Pixabay Content License: free for commercial use, no credit owed (credited anyway), never sold or shared as files; the user's free key, asked once: `keys.py open PIXABAY_API_KEY` |
| Wikimedia Commons | images, sounds and videos | per file: CC0, PD, CC BY, CC BY-SA kept; others dropped |
| Internet Archive | music (`--type music`: released tracks from its Jamendo and netlabel collections), recordings and films (`--type sound`, `video`) | public domain, CC0 and CC BY only |
| Art Institute of Chicago | public-domain artworks | CC0 images |
| Cleveland Museum of Art (Open Access) | artworks and objects, large files (up to 3400 px) | CC0 images |
| The Met (Open Access) | public-domain art and objects | CC0 images (`isPublicDomain`) |
| Rijksmuseum (`--sources rijks`) | paintings, prints, drawings and early photographs; its search matches titles | Public Domain Mark or CC0 per object |
| Openverse (in the default sound and music searches; often down, and then it sits out this film's searches for 30 minutes) | openly licensed images and sounds gathered from many sites (Flickr, museums, Freesound and others) | filtered to CC0, Public Domain Mark, CC BY, CC BY-SA; the exact licence version, licence URL and attribution line are kept per item; confirm on the item's source page before use |
| Poly Haven | HDRIs, textures | CC0 |
| NASA Image and Video Library | space and Earth images | NASA media guidelines: credit NASA, no endorsement, check third-party credits |
| FilmGrab (`--sources filmgrab`) | film stills by film title, or `cat:<cinematographer, director or genre>` | **mood only**: copyrighted films; a link and a small thumbnail for the direction board and its measurements (Film mode), never fetched in full, never in a frame; `fetch` refuses them; 2 s between requests |

Look at `research/<name>/sheet.jpg` (one small contact sheet) instead of opening each image. Show the user a shortlist only when the choice matters.

**A search never blocks silently.** A foreground search asks its sources side by side, each for about 20 s (Openverse ~30 s, since its audio answers in 10-25 s), so it takes as long as its slowest source, about 30 s at most, and prints the sources it skipped; a source that did not answer sits out this film's searches for 30 minutes (named with `--sources`, it is asked anyway); say what you are doing before one that may take a moment ("looking for the music on the Internet Archive"). For a thorough search of every source with no time limit, pass `--patient` and run it in the background (the shell tool's `run_in_background`), then read its output later — never wait on `--patient` in the foreground. `fetch` stops after three connection failures from one source (it is down: try another, or again later); a single `404` means only that one file is gone, so it moves to the next pick.

**Footage in a film:** a clip enters the picture as numbered frames, so every render stays exact: `ffmpeg -ss <start> -t <seconds> -i assets/video/<file> -vf "fps=<the film's fps>,scale=<width>:-2" -q:v 3 assets/footage/<shot>/%05d.jpg`; the page draws frame `floor((t − shot start) × fps) + 1` of that folder at time t, loaded and decoded before it is drawn, never through a `<video>` element, which does not seek to the exact frame. Stock answers what code cannot show of the real world (a real place, a crowd, a building's outside). Before a stock clip or photo is used: its tags name the subject; it is not AI-generated, a cartoon or a render; no legible brand, logo or screen is in frame (crop or soften it); and it never poses as the film's real subject (§5).

## 3. The licence log

`LICENSES.csv` gets one row per file at download time (`asset_search.py fetch` writes it): file, title, author, source URL, licence, licence URL, attribution text, modifications, date, used in, notes. **No row, no use.** Unknown licence = not used. Fill `used_in` and `modifications` when the file enters the film (for example "slowed 0.5×, low-passed").

Also log:
- the engine libraries (three.js MIT, postprocessing Zlib: already in the template);
- any AI-generated voice, music or image the user chooses to add (engine, model or voice, date, terms);
- the user's own recordings and images ("own work").

## 4. Credits

**No credits on the picture:** sources, photo credits and licence lines never sit on the frame (no corner tags, no captions under images); they go into the video description (and `research/facts.md` for facts), never as a list at the end of the film either. On screen only when the user asks, or when the source is part of the story (a document's letterhead the camera reads).

CC BY and CC BY-SA files need attribution, and for a video the description is the place (the licence asks for credit in a way reasonable for the medium); the `attribution_text` column holds a ready line. CC0 and public domain need none, but crediting is good practice. NASA material: "Courtesy NASA" plus any third-party credit on the source page.

Put the credits in **one line** in the video description (`Images: "A" by X, CC BY 4.0 · "B", The Met, CC0 · Sound: …`), longer lists as more lines there or a linked page. `make.py final` writes them from `LICENSES.csv` into `<title>-credits.txt` beside the film.

## 5. Honest use

- A found image shows what it really is. It never stands in for the client's or brand's own product, place or people, and never poses as the film's real subject when it shows something else: use the real item (supplied by the client), a clearly stylised or code-built version, or a found image labelled for what it is.
- Follow each source's own terms on top of the licence: credit lines as the source words them, no implied endorsement (NASA, museums), API rate limits and user-agent rules, and the item's source page as the final word when an aggregator such as Openverse lists it.

## 6. Never

- Material marked NC (non-commercial) or ND (no derivatives), or "personal use only", when the film will be shared.
- Frames, music or sound from copyrighted films in the deliverable.
- Scraping sites that disallow it, or downloading from sites behind a login.
- Paid services or API calls without the user's explicit OK.
