// Main JavaScript file for Viper Cloud GUI Documentation

(function() {
    'use strict';
    
    // Function to handle sticky navbar
    function handleStickyNavbar() {
        const navbar = document.querySelector('.navbar');
        const body = document.body;
        const scrollPosition = window.scrollY;
        const opfBarHeight = 100; // Height of the top OPF bar
        
        if (scrollPosition >= opfBarHeight) {
            navbar.classList.add('sticky');
            body.classList.add('navbar-sticky');
        } else {
            navbar.classList.remove('sticky');
            body.classList.remove('navbar-sticky');
        }
    }
    
    // Check sticky state on page load
    handleStickyNavbar();
    
    // Sticky navbar on scroll
    window.addEventListener('scroll', handleStickyNavbar);
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add active class to current nav item
    const currentLocation = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentLocation) {
            link.classList.add('active');
        }
    });
    
    // Copy code button for code blocks
    const codeBlocks = document.querySelectorAll('pre code');
    codeBlocks.forEach((block) => {
        const button = document.createElement('button');
        button.className = 'btn btn-sm btn-outline-secondary copy-btn';
        button.textContent = 'Copy';
        button.style.position = 'absolute';
        button.style.top = '10px';
        button.style.right = '10px';
        
        const pre = block.parentElement;
        pre.style.position = 'relative';
        pre.appendChild(button);
        
        button.addEventListener('click', () => {
            const text = block.textContent;
            navigator.clipboard.writeText(text).then(() => {
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = 'Copy';
                }, 2000);
            });
        });
    });
    
    // Highlight current section in sidebar navigation
    function highlightCurrentSection() {
        const sections = document.querySelectorAll('h2[id], h3[id]');
        const sidebarLinks = document.querySelectorAll('.docs-sidebar .nav-link');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    sidebarLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, {
            rootMargin: '-100px 0px -80% 0px'
        });
        
        sections.forEach(section => observer.observe(section));
    }
    
    // Initialize sidebar highlighting if sidebar exists
    if (document.querySelector('.docs-sidebar')) {
        highlightCurrentSection();
    }
    
    // Back to top button
    const backToTop = document.createElement('button');
    backToTop.innerHTML = '';
    backToTop.className = 'btn-back-to-top';
    backToTop.title = 'Return to top';
    backToTop.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: none;
        z-index: 1000;
        width: 0;
        height: 0;
        border-left: 20px solid transparent;
        border-right: 20px solid transparent;
        border-bottom: 30px solid #137da4;
        background: transparent;
        cursor: pointer;
        transition: opacity 0.3s ease, border-bottom-color 0.3s ease;
        opacity: 0.8;
        padding: 0;
        border-top: none;
    `;
    document.body.appendChild(backToTop);
    
    backToTop.addEventListener('mouseenter', () => {
        backToTop.style.opacity = '1';
        backToTop.style.borderBottomColor = '#0d5a75';
    });
    
    backToTop.addEventListener('mouseleave', () => {
        backToTop.style.opacity = '0.8';
        backToTop.style.borderBottomColor = '#137da4';
    });
    
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTop.style.display = 'block';
        } else {
            backToTop.style.display = 'none';
        }
    });
    
    backToTop.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
})();
