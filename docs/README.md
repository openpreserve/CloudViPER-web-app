# Viper Cloud GUI Documentation

This directory contains the GitHub Pages documentation site for Viper Cloud GUI.

## Local Development

To preview the documentation site locally:

1. Install Ruby and Bundler
2. Install dependencies:
   ```bash
   bundle install
   ```
3. Run Jekyll:
   ```bash
   bundle exec jekyll serve
   ```
4. Open http://localhost:4000 in your browser

## Structure

- `_config.yml` - Jekyll configuration
- `_layouts/` - HTML templates
- `_includes/` - Reusable components (header, footer)
- `css/` - Custom stylesheets
- `js/` - Custom JavaScript
- `img/` - Images and assets
- `*.md` - Content pages

## Adding New Pages

1. Create a new Markdown file with front matter:
   ```markdown
   ---
   layout: default
   title: Page Title
   description: Page description
   ---
   
   Your content here...
   ```

2. Add the page to navigation in `_config.yml`:
   ```yaml
   navigation:
     - title: New Page
       url: /new-page/
   ```

## GitHub Pages Deployment

This site is automatically deployed to GitHub Pages from the `gh-pages-docs` branch. Changes pushed to this branch will be live within a few minutes.

### Configuration in GitHub

1. Go to repository Settings > Pages
2. Set Source to "Deploy from a branch"
3. Select branch: `gh-pages-docs`
4. Select folder: `/docs`
5. Click Save

## Customization

### Styling

Custom styles are in `css/style.css`. The site uses Bootstrap 4 for base styling.

### Navigation

Edit navigation links in `_config.yml` under the `navigation` section.

### Footer

Edit footer content in `_includes/footer.html`.

## License

Documentation is licensed under CC BY-SA 4.0.
