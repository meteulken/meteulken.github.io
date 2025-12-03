const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// Close mobile menu when a link is clicked
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Scroll Animation Observer
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.section').forEach(section => {
    section.classList.add('hidden');
    observer.observe(section);
});

// Fetch and Render Projects
async function loadProjects() {
    try {
        const response = await fetch('projects.json');
        const data = await response.json();
        const container = document.getElementById('projects-container');

        // Helper function to create project card HTML
        const createProjectCard = (project) => {
            const tagsHtml = project.technologies.map(tech => `<span>${tech}</span>`).join('');
            return `
                <div class="project-card">
                    <div class="project-info">
                        <h3>${project.title}</h3>
                        <p>${project.description}</p>
                        <div class="tags">
                            ${tagsHtml}
                        </div>
                        <div class="project-links">
                            <a href="${project.link}" target="_blank"><i class="fab fa-github"></i> Kod</a>
                        </div>
                    </div>
                </div>
            `;
        };

        // Helper function to create a category section
        const createCategorySection = (title, projects) => {
            if (!projects || projects.length === 0) return '';

            const cardsHtml = projects.map(createProjectCard).join('');

            return `
                <div class="project-category">
                    <h3 class="category-title">${title}</h3>
                    <div class="projects-grid">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        };

        let html = '';
        html += createCategorySection('Oyun Geliştirme', data.games);
        html += createCategorySection('Backend & Sistem', data.backend);
        html += createCategorySection('Algoritmalar', data.algorithms);

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading projects:', error);
        document.getElementById('projects-container').innerHTML = '<p>Projeler yüklenirken bir hata oluştu.</p>';
    }
}

// Load projects when DOM is ready
document.addEventListener('DOMContentLoaded', loadProjects);
