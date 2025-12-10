# GitHub Pages Setup Guide

This guide will help you deploy the Viper Cloud GUI documentation to GitHub Pages.

## Prerequisites

- Repository must be on GitHub
- You need admin access to the repository

## Setup Steps

### 1. Ensure You're on the Correct Branch

```bash
git checkout gh-pages-docs
```

### 2. Commit Documentation Files

```bash
git add docs/
git commit -m "Add GitHub Pages documentation site"
git push origin gh-pages-docs
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (⚙️)
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select:
   - Branch: `gh-pages-docs`
   - Folder: `/docs`
5. Click **Save**

### 4. Wait for Deployment

- GitHub will automatically build and deploy your site
- This usually takes 1-2 minutes
- You'll see a green checkmark when it's ready

### 5. Access Your Site

Your documentation will be available at:
```
https://openpreserve.github.io/CloudViPER-web-app/
```

Or with a custom domain if configured.

## Custom Domain (Optional)

To use a custom domain:

1. Create a file named `CNAME` in the `docs/` directory
2. Add your domain name (e.g., `vipercloud.example.com`)
3. Configure DNS records with your domain provider:
   - Add a CNAME record pointing to `openpreserve.github.io`
4. Wait for DNS propagation (up to 24 hours)

## Troubleshooting

### Site Not Building

Check the Actions tab in your GitHub repository for build errors:
```
https://github.com/openpreserve/CloudViPER-web-app/actions
```

### 404 Error

- Ensure the branch and folder are correctly configured in Settings
- Check that `index.md` exists in the docs folder
- Verify the `_config.yml` baseurl setting

### Styles Not Loading

- Check that CSS files are in the correct location
- Verify paths in `_layouts/default.html` use `relative_url` filter
- Clear browser cache

### Jekyll Build Errors

Common issues:
- **Missing dependencies:** Run `bundle install`
- **Syntax errors:** Check YAML front matter in `.md` files
- **Invalid config:** Validate `_config.yml` syntax

## Local Testing

Always test locally before pushing:

```bash
cd docs
bundle install
bundle exec jekyll serve
```

Visit http://localhost:4000 to preview.

## Updating Content

1. Make changes to `.md` files or templates
2. Test locally
3. Commit and push:
   ```bash
   git add .
   git commit -m "Update documentation"
   git push origin gh-pages-docs
   ```
4. GitHub Pages will automatically rebuild

## Jekyll Resources

- [Jekyll Documentation](https://jekyllrb.com/docs/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Liquid Template Language](https://shopify.github.io/liquid/)

## Support

For issues specific to:
- **GitHub Pages:** See [GitHub Pages Help](https://docs.github.com/en/pages)
- **Jekyll:** See [Jekyll Community](https://talk.jekyllrb.com/)
- **This Project:** Open an issue on GitHub
