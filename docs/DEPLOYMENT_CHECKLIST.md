# Documentation Site Deployment Checklist

Use this checklist to deploy and customize your documentation site.

## 🔲 Pre-Deployment

- [ ] Review all content in `index.md`, `getting-started.md`, `documentation.md`, `about.md`
- [ ] Test site locally with `bundle exec jekyll serve`
- [ ] Check all internal links work correctly
- [ ] Add actual project screenshots to `docs/img/`
- [ ] Create or add project logo to `docs/img/logo.png`
- [ ] Create favicon and add to `docs/img/favicon.png`
- [ ] Update `_config.yml` with correct site title and description
- [ ] Review and update footer links in `_config.yml`

## 🔲 GitHub Pages Setup

- [ ] Commit all documentation files to repository
- [ ] Push to `gh-pages-docs` branch
- [ ] Go to repository Settings > Pages
- [ ] Set Source to branch: `gh-pages-docs`, folder: `/docs`
- [ ] Click Save
- [ ] Wait for deployment (check Actions tab)
- [ ] Verify site is accessible

## 🔲 Content Customization

- [ ] Replace placeholder text with actual project information
- [ ] Update installation instructions with real commands
- [ ] Add API documentation if applicable
- [ ] Include actual troubleshooting issues and solutions
- [ ] Add real user management procedures
- [ ] Update security guidelines for your setup
- [ ] Include actual deployment configurations

## 🔲 Visual Customization

- [ ] Add project logo to header (edit `_includes/header.html`)
- [ ] Customize color scheme in `docs/css/style.css`
- [ ] Add favicon reference in `_layouts/default.html`
- [ ] Include screenshots on home page
- [ ] Add diagrams to documentation page if needed
- [ ] Customize hero section background colors/gradients

## 🔲 Navigation & Structure

- [ ] Review navigation menu items in `_config.yml`
- [ ] Add any additional pages needed
- [ ] Update sitemap.md with new pages
- [ ] Ensure all pages are linked from somewhere
- [ ] Check mobile navigation works correctly

## 🔲 SEO & Metadata

- [ ] Update page titles for SEO
- [ ] Write descriptive meta descriptions
- [ ] Add Google Analytics (optional) in `_config.yml`
- [ ] Create robots.txt if needed
- [ ] Add sitemap.xml (Jekyll generates automatically)

## 🔲 Advanced Features (Optional)

- [ ] Set up custom domain (add CNAME file)
- [ ] Configure SSL certificate for custom domain
- [ ] Add search functionality (Algolia, Lunr.js)
- [ ] Implement version selector for docs
- [ ] Add comment system (Disqus, utterances)
- [ ] Set up analytics and monitoring
- [ ] Create RSS feed for updates

## 🔲 Testing

- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari
- [ ] Test on mobile devices
- [ ] Check all links work (no 404s)
- [ ] Verify images load correctly
- [ ] Test form submissions (if any)
- [ ] Check code examples are accurate
- [ ] Verify responsive layout on different screen sizes

## 🔲 Documentation

- [ ] Add README to main repository linking to docs site
- [ ] Document any custom Jekyll plugins used
- [ ] Create contribution guidelines for docs
- [ ] Add instructions for local development
- [ ] Document deployment process for team

## 🔲 Maintenance

- [ ] Set up regular content reviews
- [ ] Establish process for updating documentation
- [ ] Monitor GitHub Issues for documentation requests
- [ ] Update dependencies regularly (`bundle update`)
- [ ] Keep Bootstrap and Font Awesome versions current
- [ ] Review and update for new features

## 🔲 Promotion

- [ ] Announce docs site to users
- [ ] Add link to docs in main README
- [ ] Share on social media (if applicable)
- [ ] Add to project website
- [ ] Update repository description with docs link
- [ ] Include docs link in release notes

## 📝 Notes

**Site URL:** https://openpreserve.github.io/CloudViPER-web-app/

**Repository:** https://github.com/openpreserve/CloudViPER-web-app

**Branch:** gh-pages-docs

**Folder:** /docs

---

## Quick Commands

```bash
# Test locally
cd docs && bundle exec jekyll serve

# Update dependencies
cd docs && bundle update

# Clean build
cd docs && bundle exec jekyll clean

# Deploy
git add docs/
git commit -m "Update documentation"
git push origin gh-pages-docs
```

---

**Last Updated:** [Current Date]
**Updated By:** [Your Name]
