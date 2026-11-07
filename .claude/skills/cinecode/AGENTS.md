# cinecode

This repository is an agent skill for making short films with code.

- **Making a film:** when the user asks for a short film (for example "kısa film yapmak istiyorum", "make a short film with code"), read `./SKILL.md` and follow it (it starts with two questions: the mode and the purpose). The kit folder is the folder this file is in; create the film in a separate, empty project folder, never inside this repository.
- **Editing the kit itself:** keep the docs generic and positive (no personal paths or project names), keep scripts dependency-free (Node 22+ built-ins, Python 3 standard library, ffmpeg), keep `SKILL.md` frontmatter valid (`name` matches the folder name `cinecode`), and update both `README.md` (Turkish, the default page) and `README.en.md` when behaviour changes.

To use the skill from another project, add this to that project's `AGENTS.md` (adjust the path):

```markdown
When the user asks for a short film, read and follow ~/.cursor/skills/cinecode/SKILL.md.
```
