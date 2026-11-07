# Finish: the quality toolbox

The devices that lift a world from a drawing to a film. None is on everywhere: each scene takes the ones that serve its light, its subject and its distance, and the card says which and why (the Finish line, per scene). A device that does not serve the shot is left off; a scene with none says why. Everything here is a pure function of time (`engine.md`), so a device never flickers between renders.

| Group | Device | Lifts | Hurts |
|---|---|---|---|
| **Light** | one motivated key (sun, lamp, window) | form and mood; tells where we are | flat ambient-only light looks like a model |
| | sky or environment light (`env`) | soft fill that matches the sky, real reflections | an interior lit by a sky it cannot see |
| | soft shadows | contact with the ground, scale | hard default shadows read as CG |
| | contact shadows, ambient occlusion (`ao`) | weight in corners, under objects, between houses | wide aerials and soft overcast (it greys them) |
| | rim or back light | silhouettes against the background | a scene that wants mystery in the dark |
| | practicals (windows, lamps, screens, fire) | life inside the world, warmth | daylight scenes where they cannot glow |
| | light shafts, volumetric haze | air, depth, scale | clean noon, product clarity, interiors without dust |
| | bounce and coloured fill | warmth from the ground, skin, cloth | graphic or flat looks |
| **Lens** | depth of field (`dof`) | close shots, macro, a single subject | wide landscapes, establishing shots, text |
| | focus pull | a reveal, a change of attention | fast montage |
| | halation, soft highlights | film warmth around light | crisp graphic or product looks |
| | bloom (`bloom`) | lamps, sun, neon, fire, sparks | noon daylight, white walls, snow at midday, type |
| | chromatic aberration | lens character at the frame's edge | anything sharp: type, product, UI |
| | vignette | holds the eye in the frame | flat design and bright pastel looks |
| | lens flare | one deliberate sun moment | anywhere it is decoration |
| **Air** | aerial perspective, fog (`fog`) | distance pales into the air; layers | small spaces, close objects |
| | height fog, ground mist | valleys, water at dawn | dry desert noon |
| | particles (dust, snow, pollen, spray) | air you can see, motion in still shots | a clean product or graphic shot |
| | rain or snow with splashes | weather that touches surfaces | when it only falls and touches nothing |
| **Material** | PBR roughness that varies | real surfaces: worn edges, wet patches | a uniform roughness everywhere |
| | normal or micro detail | stone, plaster, fabric up close | at a distance where it shimmers |
| | translucency, subsurface, fresnel | jellyfish, skin, leaves, wax, glass | opaque things |
| | wetness and reflections | rain, sea, polished floors | dry places |
| | wear, dirt, colour variation | lived-in worlds | toy, clay or pristine product looks, on purpose |
| **Geometry** | bevels and rounded edges | catches light like real objects | low-poly or flat looks, on purpose |
| | the real parts, named | the subject's own parts, each one drawn | — (always: `quick-mode.md` Half size, never half detail) |
| | variation in instances | no two houses, trees or waves alike | — |
| | silhouette detail | readable shapes against the sky | — |
| **Motion** | secondary motion (cloth, smoke, leaves, birds) | life in held shots | a moment that must be still |
| | motion blur (`blur`) | fast moves, spinning, speed | slow shots, type, the draft (render time) |
| | subtle handheld | presence, documentary | locked graphic or product shots |
| **Post** | tone mapping (ACES or filmic; `tone`) | highlights that roll off like film; on by default | exact colours: brand colours, pixel art, flat graphic (`tone: 'NONE'`) |
| | anti-aliasing (`msaa`) | clean edges, thin lines; on by default | pixel art and hard-edged retro looks (`msaa: 0`) |
| | colour grade | the film's palette in every shot | — |
| | grain (`grain`) | film texture, hides banding | clean graphic, UI or product |

**On the card:** each scene's Finish line names its devices with a reason ("S<n> <place>: <its devices and why>; no <device>: <why>"). A device that would hurt a shot is left off there even when the film uses it elsewhere.

**Before the first draft:** every GPU scene has its light key, tone mapping and anti-aliasing unless its look needs exact colours or hard pixels, and the devices its card names; a scene that looks like a model under ambient light is not shown.
