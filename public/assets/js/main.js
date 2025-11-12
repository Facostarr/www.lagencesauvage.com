// ============================================
// CHARGEMENT AUTOMATIQUE DU SCRIPT ANALYTICS
// ============================================
(function() {
  // Charger analytics.html dans toutes les pages
  fetch('/includes/analytics.html')
    .then(response => response.text())
    .then(html => {
      // Créer un élément temporaire pour parser le HTML
      const temp = document.createElement('div');
      temp.innerHTML = html;
      
      // Extraire tous les scripts et les ajouter au head
      const scripts = temp.querySelectorAll('script');
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        
        // Copier les attributs (src, async, etc.)
        Array.from(script.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        
        // Copier le contenu du script
        if (script.textContent) {
          newScript.textContent = script.textContent;
        }
        
        // Ajouter au head
        document.head.appendChild(newScript);
      });
      
      console.log('✅ Plausible Analytics chargé avec succès');
    })
    .catch(error => {
      console.error('❌ Erreur lors du chargement de analytics:', error);
    });
})();
// =============================================================================
// MAIN.JS - L'Agence Sauvage
// Gestion du formulaire de contact et navigation mobile
// =============================================================================

// =============================================================================
// 1. NAVIGATION MOBILE (Menu Hamburger)
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.querySelector('.nav__menu');
  
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('active');
      toggle.classList.toggle('active');
      toggle.setAttribute('aria-expanded', isOpen);
      
      // Empêcher scroll body quand menu ouvert
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    
    // Fermer menu au clic sur un lien
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('active');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }
  
  // =============================================================================
  // 2. GESTION DU FORMULAIRE DE CONTACT
  // =============================================================================
  const form = document.getElementById('auditForm');
  const feedback = document.getElementById('formFeedback');
  
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Désactiver le bouton pour éviter double soumission
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Envoi en cours...';
      
      // Cacher feedback précédent
      feedback.style.display = 'none';
      
      try {
        // Récupérer les données du formulaire
        const formData = {
          name: form.querySelector('[name="name"]').value.trim(),
          email: form.querySelector('[name="email"]').value.trim(),
          phone: form.querySelector('[name="phone"]').value.trim() || '',
          company: form.querySelector('[name="company"]').value.trim(),
          company_size: form.querySelector('[name="company_size"]').value,
          challenge: form.querySelector('[name="challenge"]').value.trim() || ''
        };
        
        // Validation supplémentaire côté client
        if (!formData.name || !formData.email || !formData.company || !formData.company_size) {
          throw new Error('Veuillez remplir tous les champs obligatoires');
        }
        
        // Validation email simple
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          throw new Error('Veuillez fournir une adresse email valide');
        }
        
        // Appel à l'API Vercel
        const response = await fetch('/api/submit-lead', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.message || 'Une erreur est survenue');
        }
        
        // ✅ SUCCÈS
        showFeedback('success', '✅ Merci ! Nous vous contacterons sous 24h pour planifier votre audit gratuit.');
        
        // Réinitialiser le formulaire
        form.reset();
        
        // Optionnel : Redirection après 3 secondes
        // setTimeout(() => {
        //   window.location.href = '/merci.html';
        // }, 3000);
        
        // Tracking (si Google Analytics configuré)
        if (typeof gtag !== 'undefined') {
          gtag('event', 'form_submission', {
            'event_category': 'lead',
            'event_label': 'audit_gratuit'
          });
        }
        
      } catch (error) {
        console.error('Erreur soumission formulaire:', error);
        
        // ❌ ERREUR
        showFeedback('error', 
          `❌ ${error.message || 'Une erreur est survenue. Veuillez réessayer ou nous contacter directement.'}`
        );
      } finally {
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
  
  // =============================================================================
  // 3. FONCTION D'AFFICHAGE DES MESSAGES
  // =============================================================================
  function showFeedback(type, message) {
    feedback.className = `form-feedback form-feedback--${type}`;
    feedback.textContent = message;
    feedback.style.display = 'block';
    
    // Scroll vers le message
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Auto-hide pour les succès après 10 secondes
    if (type === 'success') {
      setTimeout(() => {
        feedback.style.display = 'none';
      }, 10000);
    }
  }
  
  // =============================================================================
  // 4. SMOOTH SCROLL POUR LES ANCRES
  // =============================================================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      
      // Ignorer les ancres vides
      if (href === '#' || href === '#!') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Fermer le menu mobile si ouvert
        const menu = document.querySelector('.nav__menu');
        const toggle = document.querySelector('.nav__toggle');
        if (menu && menu.classList.contains('active')) {
          menu.classList.remove('active');
          toggle.classList.remove('active');
          toggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        }
      }
    });
  });
  
  // =============================================================================
  // 5. GESTION DES DÉTAILS/ACCORDÉONS (FAQ)
  // =============================================================================
  const details = document.querySelectorAll('details');
  details.forEach(detail => {
    detail.addEventListener('toggle', function() {
      if (this.open) {
        // Fermer les autres accordéons (optionnel - comportement accordion exclusif)
        // details.forEach(d => {
        //   if (d !== this) d.open = false;
        // });
      }
    });
  });
  
  // =============================================================================
  // 6. LAZY LOADING DES IMAGES (si implémenté)
  // =============================================================================
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
});

// =============================================================================
// 7. GESTION DU FOCUS POUR L'ACCESSIBILITÉ
// =============================================================================
// Ajouter une classe au body quand l'utilisateur navigue au clavier
document.addEventListener('keydown', function(e) {
  if (e.key === 'Tab') {
    document.body.classList.add('user-is-tabbing');
  }
});

document.addEventListener('mousedown', function() {
  document.body.classList.remove('user-is-tabbing');
});

// =============================================================================
// 8. PERFORMANCE - Préchargement des pages critiques
// =============================================================================
window.addEventListener('load', function() {
  // Précharger les pages importantes après le chargement initial
  const criticalPages = ['/services.html', '/about.html'];
  
  criticalPages.forEach(page => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = page;
    document.head.appendChild(link);
  });
});
