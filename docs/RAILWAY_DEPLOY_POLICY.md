# Railway Deploy Policy

## Production rule

- Production deploys must be triggered by the Railway GitHub integration.
- Do not run `railway up` for a service that is already connected to GitHub.
- Railway CLI is allowed for `login`, `link`, `status`, `logs`, and `variables`.
- Keep only one GitHub repository connected to each Railway service.

## Why

- `git push` already triggers a build on Railway.
- `railway up` creates a second manual deploy for the same service.
- If the same Railway service is linked to more than one GitHub repo, pushes can trigger duplicate builds again.

## Safe production flow

1. Update variables in Railway Dashboard or with `railway variables`.
2. Commit and push to the branch connected in Railway.
3. Watch the deployment in Railway Dashboard.
4. Use `railway logs` only for diagnosis, not to publish code.

## Security rule

- Never store production secrets in `.bat`, `.sh`, `.ps1`, `.json`, or committed docs.
- If a secret was committed before, rotate it outside the repository.
