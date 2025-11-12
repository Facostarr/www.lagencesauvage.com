// =============================================================================
// VERCEL SERVERLESS FUNCTION - Submit Lead to Notion + Email
// =============================================================================
// Fichier : /api/submit-lead.js
// 
// Cette fonction gère :
// 1. La validation des données du formulaire
// 2. L'envoi vers Notion (base de données Leads)
// 3. L'envoi d'un email de notification
// 4. La gestion des erreurs
// =============================================================================

// Importer les dépendances (Vercel les fournit automatiquement)
import { Client } from '@notionhq/client';

/**
 * Configuration Notion
 * Les secrets sont stockés dans les variables d'environnement Vercel
 */
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/**
 * Handler principal de la fonction Vercel
 */
export default async function handler(req, res) {
  // =============================================================================
  // 1. CORS Headers
  // =============================================================================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Gérer preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // =============================================================================
  // 2. Vérifier la méthode HTTP
  // =============================================================================
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Méthode non autorisée. Utilisez POST.'
    });
  }
  
  // =============================================================================
  // 3. Valider les variables d'environnement
  // =============================================================================
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
    console.error('❌ Variables d\'environnement manquantes');
    return res.status(500).json({
      success: false,
      message: 'Configuration serveur incomplète. Contactez le support.'
    });
  }
  
  // =============================================================================
  // 4. Extraire et valider les données
  // =============================================================================
  const { name, email, phone, company, company_size, challenge } = req.body;
  
  // Validation des champs obligatoires
  if (!name || !email || !company || !company_size) {
    return res.status(400).json({
      success: false,
      message: 'Tous les champs obligatoires doivent être remplis.'
    });
  }
  
  // Validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Adresse email invalide.'
    });
  }
  
  // Validation taille entreprise
  const validSizes = ['1-5', '6-20', '21-50', '50+'];
  if (!validSizes.includes(company_size)) {
    return res.status(400).json({
      success: false,
      message: 'Taille d\'entreprise invalide.'
    });
  }
  
  try {
    // =============================================================================
    // 5. Créer l'entrée dans Notion
    // =============================================================================
    const notionPage = await notion.pages.create({
      parent: {
        database_id: DATABASE_ID
      },
      properties: {
        // Nom (Title property)
        'Name': {
          title: [
            {
              text: {
                content: name.trim()
              }
            }
          ]
        },
        
        // Email
        'Email': {
          email: email.trim().toLowerCase()
        },
        
        // Téléphone (optionnel)
        'Téléphone': phone && phone.trim() !== '' 
          ? { phone_number: phone.trim() }
          : { phone_number: null },
        
        // Entreprise
        'Entreprise': {
          rich_text: [
            {
              text: {
                content: company.trim()
              }
            }
          ]
        },
        
        // Taille
        'Taille': {
          select: {
            name: company_size
          }
        },
        
        // Défi (optionnel)
        'Défi': {
          rich_text: [
            {
              text: {
                content: challenge && challenge.trim() !== '' 
                  ? challenge.trim() 
                  : 'Non renseigné'
              }
            }
          ]
        },
        
        // Statut (automatique : "Nouveau")
        'Statut': {
          select: {
            name: 'Nouveau'
          }
        },
        
        // Source (automatique : "Site Web - Homepage")
        'Source': {
          select: {
            name: 'Site Web - Homepage'
          }
        },
        
        // Date de soumission
        'Date Soumission': {
          date: {
            start: new Date().toISOString().split('T')[0] // Format YYYY-MM-DD
          }
        }
      }
    });
    
    console.log('✅ Lead créé dans Notion:', notionPage.id);
    
    // =============================================================================
    // 6. Envoyer email de notification
    // =============================================================================
    try {
      await sendEmailNotification({
        name,
        email,
        phone: phone || 'Non renseigné',
        company,
        company_size,
        challenge: challenge || 'Non renseigné',
        notionUrl: notionPage.url
      });
      
      console.log('✅ Email de notification envoyé');
    } catch (emailError) {
      // Ne pas bloquer si l'email échoue
      console.error('⚠️ Erreur envoi email (non bloquant):', emailError.message);
    }
    
    // =============================================================================
    // 7. Réponse succès
    // =============================================================================
    return res.status(200).json({
      success: true,
      message: 'Lead enregistré avec succès',
      notionPageId: notionPage.id
    });
    
  } catch (error) {
    // =============================================================================
    // 8. Gestion des erreurs
    // =============================================================================
    console.error('❌ Erreur lors de la soumission:', error);
    
    // Erreur spécifique Notion
    if (error.code === 'validation_error') {
      return res.status(400).json({
        success: false,
        message: 'Format de données invalide pour Notion',
        details: error.message
      });
    }
    
    if (error.code === 'object_not_found') {
      return res.status(500).json({
        success: false,
        message: 'Base de données Notion introuvable. Contactez le support.'
      });
    }
    
    if (error.code === 'unauthorized') {
      return res.status(500).json({
        success: false,
        message: 'Problème d\'authentification Notion. Contactez le support.'
      });
    }
    
    // Erreur générique
    return res.status(500).json({
      success: false,
      message: 'Une erreur est survenue. Veuillez réessayer ou nous contacter directement.',
      // En développement uniquement (à retirer en production) :
      // debug: error.message
    });
  }
}

// =============================================================================
// FONCTION : Envoi d'email de notification
// =============================================================================
async function sendEmailNotification(leadData) {
  const {
    name,
    email,
    phone,
    company,
    company_size,
    challenge,
    notionUrl
  } = leadData;
  
  // Si vous utilisez SendGrid (gratuit jusqu'à 100 emails/jour)
  if (process.env.SENDGRID_API_KEY) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
      to: 'franck@lagencesauvage.com', // Votre email
      from: process.env.SENDGRID_FROM_EMAIL || 'hello@lagencesauvage.com',
      subject: `🎯 Nouveau lead : ${name} (${company})`,
      text: `
Nouveau lead reçu depuis le site web !

👤 Nom : ${name}
📧 Email : ${email}
📞 Téléphone : ${phone}
🏢 Entreprise : ${company}
👥 Taille : ${company_size} employés
💡 Défi : ${challenge}

🔗 Voir dans Notion : ${notionUrl}

---
L'Agence Sauvage - Notifications automatiques
      `,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #224f3c;">🎯 Nouveau lead reçu !</h2>
  
  <div style="background: #f2ede1; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>👤 Nom :</strong> ${name}</p>
    <p><strong>📧 Email :</strong> <a href="mailto:${email}">${email}</a></p>
    <p><strong>📞 Téléphone :</strong> ${phone}</p>
    <p><strong>🏢 Entreprise :</strong> ${company}</p>
    <p><strong>👥 Taille :</strong> ${company_size} employés</p>
    <p><strong>💡 Défi principal :</strong> ${challenge}</p>
  </div>
  
  <a href="${notionUrl}" 
     style="display: inline-block; background: #224f3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
    🔗 Voir dans Notion
  </a>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
  
  <p style="color: #8c8982; font-size: 14px;">
    L'Agence Sauvage - Notifications automatiques<br>
    Lead capturé depuis : <strong>Site Web - Homepage</strong>
  </p>
</div>
      `
    };
    
    await sgMail.send(msg);
  }
  
  // Alternative : Resend.com (aussi gratuit)
  else if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'notifications@lagencesauvage.com',
        to: 'contact@lagencesauvage.com',
        subject: `🎯 Nouveau lead : ${name} (${company})`,
        html: `
<h2>🎯 Nouveau lead reçu !</h2>
<p><strong>Nom :</strong> ${name}</p>
<p><strong>Email :</strong> ${email}</p>
<p><strong>Téléphone :</strong> ${phone}</p>
<p><strong>Entreprise :</strong> ${company}</p>
<p><strong>Taille :</strong> ${company_size}</p>
<p><strong>Défi :</strong> ${challenge}</p>
<p><a href="${notionUrl}">Voir dans Notion</a></p>
        `
      })
    });
    
    if (!response.ok) {
      throw new Error('Erreur envoi email Resend');
    }
  }
  
  // Si aucune clé API configurée, logger un warning
  else {
    console.warn('⚠️ Aucune API email configurée. Configurez SENDGRID_API_KEY ou RESEND_API_KEY');
  }
}
