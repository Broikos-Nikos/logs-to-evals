# Publishing logs-to-evals

Everything the repository needs on GitHub, written before it exists.

## The About box

**Description**, 350 characters or fewer, carrying the number:

> Turn a production log into a test set. Across 50 synthetic support logs of 5,000 lines, 60 cases
> picked by this selector hold failing examples of 7.62 of 8 known failure modes; 60 picked at random
> hold 2.92. Most of it is the users' own thumbs down, and the page shows how much.

**Homepage**: `https://broikos-nikos.github.io/logs-to-evals/`

**Topics**, ten:

```
llm  evals  llm-evaluation  test-generation  regression-testing  observability  clustering  pii  typescript  data-visualization
```

`evals` and `llm-evaluation` are the two that matter: somebody with a support bot in production and no
test set is searching one of them.

## Settings

- **Public.** Issues on, wiki, projects and discussions off.
- **Pages from GitHub Actions**, not from a branch: the workflow deploys only when the build gates and
  the browser gates both pass.
- **No default community files.** The MIT LICENSE is committed, and `check:licence` holds the README to
  it.

## The order

1. Create the repository with the description, homepage and topics above.
2. Push `main` with its whole history, every commit authored `Nikos Broikos
   <broikos.nikolaos@gmail.com>`, none co-authored.
3. Turn Pages on with GitHub Actions as the source, and watch the first deploy to green.
4. Open the live page in a browser at 1280 and 390 and look at it.
5. Only then, a second push puts the live link at the top of the README.
