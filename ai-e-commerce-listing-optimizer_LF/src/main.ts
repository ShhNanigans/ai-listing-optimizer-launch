/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Optimized Main Application with Lazy Loading and Performance Enhancements

import { 
  createElement, 
  setButtonLoading, 
  displayError, 
  createTemplate,
  delegateEvent,
  debounce 
} from './utils/dom.js';
import { 
  generateAnalysis, 
  generateABTest, 
  generatePromoContent, 
  generateFAQs,
  requestQueue 
} from './utils/api.js';

// --- Type Definitions ---
interface Recommendation {
  element: string;
  suggestion: string;
  reasoning: string;
}

interface WebSource {
  uri: string;
  title: string;
}

interface ListingAnalysis {
  overall_assessment: string;
  recommendations: Recommendation[];
  suggested_keywords: string[];
  sources?: WebSource[];
}

interface ABTestVariation {
  title: string;
  description: string;
}

interface PromoContent {
  instagram_post: string;
  promotional_email: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

// --- Application State ---
class AppState {
  private static instance: AppState;
  private _currentAnalysis: ListingAnalysis | null = null;
  private _originalListing: string | null = null;
  private _currentFAQs: FAQItem[] | null = null;

  static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState();
    }
    return AppState.instance;
  }

  get currentAnalysis() { return this._currentAnalysis; }
  set currentAnalysis(value: ListingAnalysis | null) { this._currentAnalysis = value; }

  get originalListing() { return this._originalListing; }
  set originalListing(value: string | null) { this._originalListing = value; }

  get currentFAQs() { return this._currentFAQs; }
  set currentFAQs(value: FAQItem[] | null) { this._currentFAQs = value; }
}

const appState = AppState.getInstance();

// --- Utility Functions ---
const formatAIResponseWithAsterisks = (rawText: string): string => {
  if (!rawText) return '';
  const withBold = rawText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const paragraphs = withBold.split(/\n\s*(?=\*)/);
  const htmlParagraphs = paragraphs.map(p => {
    let content = p.trim();
    if (content.startsWith('*')) {
      content = content.substring(1).trim();
    }
    return `<p>${content.replace(/\n/g, '<br>')}</p>`;
  });
  return htmlParagraphs.join('');
};

const parseAnalysisFromText = (text: string): ListingAnalysis => {
  const analysis: ListingAnalysis = {
    overall_assessment: '',
    recommendations: [],
    suggested_keywords: [],
  };

  const assessmentMatch = text.match(/##\s*Overall Assessment\s*([\s\S]*?)(?=\n##|$)/);
  if (assessmentMatch) {
    analysis.overall_assessment = assessmentMatch[1].trim();
  }

  const tagsMatch = text.match(/##\s*Suggested SEO Tags \(13\)\s*([\s\S]*?)(?=\n##|$)/);
  if (tagsMatch) {
    analysis.suggested_keywords = tagsMatch[1]
      .split('\n')
      .map(kw => kw.replace(/^-/, '').trim())
      .filter(Boolean)
      .map(kw => kw.substring(0, 20));
  }

  const recommendationsBlockMatch = text.match(/##\s*Actionable Recommendations\s*([\s\S]*?)(?=\n##\s*Suggested SEO Tags|$)/);
  if (recommendationsBlockMatch) {
    const recommendationsText = recommendationsBlockMatch[1];
    const elementMatches = [...recommendationsText.matchAll(/^###\s*Element:\s*(.*)/gm)];
    elementMatches.forEach((match, index) => {
      const element = match[1].trim();
      const startIndex = match.index! + match[0].length;
      const nextMatch = elementMatches[index + 1];
      const endIndex = nextMatch ? nextMatch.index : recommendationsText.length;
      const chunk = recommendationsText.substring(startIndex, endIndex);
      const suggestionMatch = chunk.match(/####\s*Suggestion:\s*([\s\S]*?)(?=\n####\s*Reasoning:|$)/);
      const suggestion = suggestionMatch ? suggestionMatch[1].trim() : '';
      const reasoningMatch = chunk.match(/####\s*Reasoning:\s*([\s\S]*)/);
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : '';
      if (element && (suggestion || reasoning)) {
        analysis.recommendations.push({ element, suggestion, reasoning });
      }
    });
  }
  return analysis;
};

// --- Lazy Loading Modules ---
const loadComponentStyles = () => {
  return import('./styles/components.css');
};

const copyToClipboard = async (text: string, button?: HTMLButtonElement): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.classList.add('copied');
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // Fallback for older browsers
    const textArea = createElement('textarea', { textContent: text });
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      if (button) {
        button.textContent = 'Copied!';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = 'Copy';
          button.classList.remove('copied');
        }, 2000);
      }
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError);
    }
    document.body.removeChild(textArea);
  }
};

// --- UI Rendering Functions (Optimized) ---
const renderApp = (): void => {
  const appContainer = document.getElementById('app-container');
  if (!appContainer) return;

  const template = `
    <h1>AI E-Commerce Listing Optimizer</h1>
    <p class="subtitle">Paste your product listing, get AI-powered improvement suggestions, and then generate marketing assets like A/B tests and promo copy.</p>
    
    <div class="input-container">
      <textarea 
        id="listing-input" 
        placeholder="Paste your full product listing here (title, description, features...)&#10;&#10;e.g.,&#10;Title: Custom Wedding Welcome Sign&#10;Description: A beautiful handmade sign to welcome guests to your special day. Made from wood."
        spellcheck="false"
      ></textarea>
      
      <button id="generate-btn">
        <span class="btn-text">Analyze Listing</span>
      </button>
    </div>

    <div id="results-container" aria-live="polite"></div>
  `;

  appContainer.innerHTML = template;
};

const displayResults = async (analysis: ListingAnalysis): Promise<void> => {
  const resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) return;

  appState.currentAnalysis = analysis;

  // Load component styles asynchronously
  loadComponentStyles();

  const assessmentTemplate = `
    <div class="results-section">
      <h3>Overall Assessment</h3>
      <div class="assessment-content">
        ${formatAIResponseWithAsterisks(analysis.overall_assessment)}
      </div>
    </div>
  `;

  const recommendationsTemplate = `
    <div class="results-section">
      <div class="section-header">
        <h3>Actionable Recommendations</h3>
      </div>
      <div class="recommendations-grid">
        ${analysis.recommendations.map(rec => `
          <div class="recommendation-card">
            <div class="card-header">
              <h4 class="card-title">${rec.element}</h4>
              <button class="copy-btn" data-copy="${rec.suggestion.replace(/"/g, '&quot;')}">Copy</button>
            </div>
            <div class="card-body">
              <div class="suggestion">
                <strong>Suggestion:</strong><br>
                ${formatAIResponseWithAsterisks(rec.suggestion)}
              </div>
              <div class="reasoning mt-sm">
                <strong>Reasoning:</strong><br>
                ${formatAIResponseWithAsterisks(rec.reasoning)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const keywordsTemplate = `
    <div class="results-section">
      <div class="section-header">
        <h3>Suggested SEO Tags (${analysis.suggested_keywords.length})</h3>
        <button class="copy-btn" id="copy-tags-btn">Copy All Tags</button>
      </div>
      <div class="keywords-container">
        ${analysis.suggested_keywords.map(keyword => 
          `<span class="keyword-tag">${keyword}</span>`
        ).join('')}
      </div>
    </div>
  `;

  const sourcesTemplate = analysis.sources && analysis.sources.length > 0 ? `
    <div class="results-section">
      <h3>Sources & Research</h3>
      <ul class="sources-list">
        ${analysis.sources.map(source => `
          <li>
            <a href="${source.uri}" target="_blank" rel="noopener noreferrer">
              ${source.title}
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  const nextStepsTemplate = `
    <div class="results-section">
      <h3>Next Steps</h3>
      <div class="next-steps-container">
        <button class="secondary-btn" id="ab-test-btn">
          <span class="btn-text">Generate A/B Tests</span>
        </button>
        <button class="secondary-btn" id="promo-btn">
          <span class="btn-text">Draft Promo Content</span>
        </button>
        <button class="secondary-btn" id="faq-btn">
          <span class="btn-text">Generate FAQs</span>
        </button>
      </div>
      <div id="extra-tools-results"></div>
    </div>
  `;

  resultsContainer.innerHTML = 
    assessmentTemplate + 
    recommendationsTemplate + 
    keywordsTemplate + 
    sourcesTemplate + 
    nextStepsTemplate;

  // Set up event delegation for copy buttons
  delegateEvent(resultsContainer, '.copy-btn', 'click', async (event, target) => {
    const button = target as HTMLButtonElement;
    const copyData = button.dataset.copy;
    
    if (button.id === 'copy-tags-btn') {
      await copyToClipboard(analysis.suggested_keywords.join(', '), button);
    } else if (copyData) {
      await copyToClipboard(copyData, button);
    }
  });

  // Set up next steps buttons with request queuing
  const abTestBtn = document.getElementById('ab-test-btn') as HTMLButtonElement;
  const promoBtn = document.getElementById('promo-btn') as HTMLButtonElement;
  const faqBtn = document.getElementById('faq-btn') as HTMLButtonElement;

  if (abTestBtn) {
    abTestBtn.addEventListener('click', () => {
      requestQueue.add(() => handleABTestGeneration(abTestBtn));
    });
  }

  if (promoBtn) {
    promoBtn.addEventListener('click', () => {
      requestQueue.add(() => handlePromoGeneration(promoBtn));
    });
  }

  if (faqBtn) {
    faqBtn.addEventListener('click', () => {
      requestQueue.add(() => handleFAQGeneration(faqBtn));
    });
  }
};

// --- Event Handlers (Optimized) ---
const handleABTestGeneration = async (button: HTMLButtonElement): Promise<void> => {
  if (!appState.currentAnalysis) return;
  
  setButtonLoading(button, true, 'Generate A/B Tests');
  try {
    const result = await generateABTest(appState.currentAnalysis);
    displayABTestVariations(result);
    button.style.display = 'none';
  } catch (error) {
    console.error("A/B test generation failed:", error);
    displayError('Sorry, there was an error generating A/B tests.');
  } finally {
    setButtonLoading(button, false, 'Generate A/B Tests');
  }
};

const handlePromoGeneration = async (button: HTMLButtonElement): Promise<void> => {
  if (!appState.currentAnalysis) return;
  
  setButtonLoading(button, true, 'Draft Promo Content');
  try {
    const result = await generatePromoContent(appState.currentAnalysis);
    displayPromoContent(result);
    button.style.display = 'none';
  } catch (error) {
    console.error("Promo content generation failed:", error);
    displayError('Sorry, there was an error generating promotional content.');
  } finally {
    setButtonLoading(button, false, 'Draft Promo Content');
  }
};

const handleFAQGeneration = async (button: HTMLButtonElement): Promise<void> => {
  if (!appState.currentAnalysis) return;
  
  setButtonLoading(button, true, 'Generate FAQs');
  try {
    const result = await generateFAQs(appState.currentAnalysis);
    displayFAQs(result.faqs);
    button.style.display = 'none';
  } catch (error) {
    console.error("FAQ generation failed:", error);
    displayError('Sorry, there was an error generating FAQs.');
  } finally {
    setButtonLoading(button, false, 'Generate FAQs');
  }
};

// --- Display Functions (Lazy Loaded) ---
const displayABTestVariations = (variations: ABTestVariation[]): void => {
  const extraToolsResults = document.getElementById('extra-tools-results');
  if (!extraToolsResults) return;

  const template = `
    <div class="ab-test-section">
      <h4>A/B Test Variations</h4>
      <div class="ab-test-variations">
        ${variations.map((variation, index) => `
          <div class="variation-card">
            <div class="variation-title">Variation ${String.fromCharCode(65 + index)}</div>
            <div class="variation-content">
              <strong>Title:</strong><br>
              ${variation.title}<br><br>
              <strong>Description:</strong><br>
              ${variation.description}
            </div>
            <button class="copy-btn mt-sm" data-copy="${variation.title}\n\n${variation.description}">
              Copy Variation
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  extraToolsResults.innerHTML += template;
};

const displayPromoContent = (promo: PromoContent): void => {
  const extraToolsResults = document.getElementById('extra-tools-results');
  if (!extraToolsResults) return;

  const template = `
    <div class="promo-section">
      <h4>Promotional Content</h4>
      
      <div class="promo-section">
        <h5>Instagram Post</h5>
        <div class="promo-content">${promo.instagram_post}</div>
        <button class="copy-btn mt-sm" data-copy="${promo.instagram_post}">Copy Instagram Post</button>
      </div>
      
      <div class="promo-section">
        <h5>Promotional Email</h5>
        <div class="promo-content">${promo.promotional_email}</div>
        <button class="copy-btn mt-sm" data-copy="${promo.promotional_email}">Copy Email</button>
      </div>
    </div>
  `;

  extraToolsResults.innerHTML += template;
};

const displayFAQs = (faqs: FAQItem[]): void => {
  const extraToolsResults = document.getElementById('extra-tools-results');
  if (!extraToolsResults) return;

  appState.currentFAQs = faqs;

  const template = `
    <div class="faq-section">
      <h4>Frequently Asked Questions</h4>
      <ul class="faq-list">
        ${faqs.map(faq => `
          <li class="faq-item">
            <h5 class="faq-question">${faq.question}</h5>
            <p class="faq-answer">${faq.answer}</p>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  extraToolsResults.innerHTML += template;
};

// --- Main Application Logic ---
const initializeApp = (): void => {
  renderApp();
  
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
  const listingInput = document.getElementById('listing-input') as HTMLTextAreaElement;
  const resultsContainer = document.getElementById('results-container');
  const yearSpan = document.getElementById('year');

  if (!generateBtn || !listingInput || !resultsContainer) {
    console.error('Critical UI elements not found. App cannot start.');
    return;
  }

  // Set current year in footer
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear().toString();
  }

  // Debounced input validation
  const validateInput = debounce(() => {
    const value = listingInput.value.trim();
    generateBtn.disabled = !value;
  }, 300);

  listingInput.addEventListener('input', validateInput);

  // Initial generation handler
  const handleInitialGeneration = async (): Promise<void> => {
    const listing = listingInput.value.trim();
    if (!listing) {
      displayError('Please paste your product listing to get started.');
      return;
    }

    appState.originalListing = listing;
    setButtonLoading(generateBtn, true, 'Analyze Listing');
    resultsContainer.innerHTML = '';

    try {
      const { content, sources } = await generateAnalysis(listing);
      
      if (content) {
        const analysis = parseAnalysisFromText(content);
        analysis.sources = sources;
        await displayResults(analysis);
      } else {
        displayError('The AI returned an empty response. Please try again.');
      }
    } catch (error) {
      console.error('Initial generation failed:', error);
      displayError('An error occurred while communicating with the server. Please check your connection and try again.');
    } finally {
      setButtonLoading(generateBtn, false, 'Analyze Listing');
    }
  };

  generateBtn.addEventListener('click', handleInitialGeneration);

  // Enable Enter key submission (Ctrl+Enter)
  listingInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey && !generateBtn.disabled) {
      e.preventDefault();
      handleInitialGeneration();
    }
  });
};

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', initializeApp);

// Performance monitoring
if ('performance' in window && 'measure' in performance) {
  window.addEventListener('load', () => {
    performance.measure('app-init', 'navigationStart');
    console.log('App initialization time:', performance.getEntriesByName('app-init')[0].duration + 'ms');
  });
}