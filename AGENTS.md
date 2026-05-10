# AGENTS.md

## Project goal

This is a hackathon project. Prioritize keeping the demo working, preserving teammates' work, and making small, safe changes.

## Merge conflict policy

When asked to resolve merge conflicts:

1. Start by inspecting the repo state.

   Run:

   ```bash
   git status
   git diff --name-only --diff-filter=U
   ```

2. Fetch and merge using clearer conflict context when possible.

   Prefer:

   ```bash
   git fetch origin
   git -c merge.conflictstyle=zdiff3 merge origin/main
   ```

3. For every conflicted file, understand intent before editing.

   Use:

   ```bash
   git diff --merge <file>
   git diff :1:<file> :2:<file>
   git diff :1:<file> :3:<file>
   ```

   Interpret the sides as:

   - `:1:` = base version
   - `:2:` = ours/current branch
   - `:3:` = theirs/incoming branch

4. Do not blindly choose one side.

   Avoid using:

   ```bash
   git checkout --ours <file>
   git checkout --theirs <file>
   ```

   unless one side is clearly obsolete or broken.

5. Prefer preserving both changes.

   Combine both sides when possible, especially for:

   - UI additions
   - routes/screens/pages
   - imports
   - helper functions
   - configuration changes
   - Android manifest or Gradle changes
   - package/dependency changes

6. Resolve the final behavior first, then write the code.

   Before editing a conflict, decide:

   - What was our branch trying to do?
   - What was the incoming branch trying to do?
   - Are they compatible?
   - Does one supersede the other?
   - What final behavior keeps the app/demo working?

7. Be careful with risky files.

   For these files, make minimal edits and preserve intent:

   - package.json
   - package-lock.json
   - pnpm-lock.yaml
   - yarn.lock
   - build.gradle
   - settings.gradle
   - AndroidManifest.xml
   - navigation/routing files
   - database/schema/migration files
   - shared types/interfaces
   - environment/config files

8. For lockfiles and generated files:

   Prefer resolving the source file first, then regenerate the generated file using the project's normal tool.

   Examples:

   ```bash
   npm install
   pnpm install
   ./gradlew build
   ```

9. For import conflicts:

   Keep both imports temporarily if unsure, finish the merge, then run lint/type checks and remove unused imports.

10. After editing, verify no conflict markers remain.

    Run:

    ```bash
    git diff --check
    grep -R "<<<<<<<\|=======\|>>>>>>>" . --exclude-dir=.git
    ```

11. Run the fastest relevant project check.

    Use whichever applies:

    ```bash
    npm test
    npm run build
    pnpm test
    pnpm build
    ./gradlew test
    ./gradlew assembleDebug
    ```

12. Commit the merge resolution only after checks pass or after documenting why checks could not run.

    Use a clear commit message:

    ```bash
    git add .
    git commit -m "Resolve merge conflicts"
    ```

## Hackathon safety rules

- Do not delete teammate features to make conflicts disappear.
- Do not rewrite large parts of the app during conflict resolution.
- Do not introduce new dependencies while resolving conflicts unless absolutely necessary.
- Do not change unrelated files.
- Keep the demo path working.
- If two changes conflict conceptually, choose the safer option and leave a note in the PR.
- If the conflict affects user-visible behavior and there is no clear correct answer, explain the assumption made.

## Reporting after conflict resolution

After resolving conflicts, summarize:

- Which files had conflicts.
- What each side was trying to do.
- How the final resolution combined or chose between them.
- Which checks were run.
- Any risky assumptions or follow-up needed.
