
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

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

// --- State & Constants ---
let currentAnalysis: ListingAnalysis | null = null;
let originalListing: string | null = null;
let currentFAQs: FAQItem[] | null = null;

// --- UI Helpers ---
const setButtonLoading = (button: HTMLButtonElement, isLoading: boolean, defaultText: string) => {
  button.disabled = isLoading;
  const textEl = button.querySelector('.btn-text') as HTMLElement;
  if (isLoading) {
      textEl.textContent = 'Generating...';
      const loader = document.createElement('div');
      loader.className = 'loader';
      button.prepend(loader);
  } else {
      textEl.textContent = defaultText;
      button.querySelector('.loader')?.remove();
  }
};

const displayError = (message: string) => {
  const resultsContainer = document.getElementById('results-container');
  if (resultsContainer) {
      resultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
  }
};

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

// --- UI Rendering ---

const renderApp = () => {
  const appContainer = document.getElementById('app-container');
  if (!appContainer) return;

  appContainer.innerHTML = `
    <h1>AI E-Commerce Listing Optimizer</h1>
    <p class="subtitle">Paste your product listing, get AI-powered improvement suggestions, and then generate marketing assets like A/B tests and promo copy.</p>
    
    <div class="input-container">
      <textarea id="listing-input" placeholder="Paste your full product listing here (title, description, features...)\n\ne.g.,\nTitle: Custom Wedding Welcome Sign\nDescription: A beautiful handmade sign to welcome guests to your special day. Made from wood."></textarea>
      
      <button id="generate-btn">
        <span class="btn-text">Analyze Listing</span>
      </button>
    </div>

    <div id="results-container" aria-live="polite"></div>
  `;
};

const displayResults = (analysis: ListingAnalysis) => {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;
    currentAnalysis = analysis;
    resultsContainer.innerHTML = '';

    const assessmentSection = document.createElement('div');
    assessmentSection.className = 'analysis-section';
    assessmentSection.innerHTML = `
        <div class="section-header"><h2>Overall Assessment</h2></div>
        <div class="formatted-ai-response">${formatAIResponseWithAsterisks(analysis.overall_assessment)}</div>
    `;
    resultsContainer.appendChild(assessmentSection);

    if (analysis.recommendations.length > 0) {
        const recommendationsSection = document.createElement('div');
        recommendationsSection.className = 'analysis-section';
        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = `<h2>Actionable Recommendations</h2>`;
        recommendationsSection.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'recommendations-grid';
        analysis.recommendations.forEach(rec => {
            const card = document.createElement('div');
            card.className = 'recommendation-card';
            const cardHeader = document.createElement('div');
            cardHeader.className = 'recommendation-header';
            const cardTitle = document.createElement('h4');
            cardTitle.innerHTML = `Recommendation for: <span>${rec.element}</span>`;
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(rec.suggestion).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                });
            });
            cardHeader.appendChild(cardTitle);
            cardHeader.appendChild(copyBtn);
            const cardBody = document.createElement('div');
            cardBody.className = 'recommendation-body';
            cardBody.innerHTML = `
                <p><strong>Suggestion:</strong></p>
                <div class="formatted-ai-response">${formatAIResponseWithAsterisks(rec.suggestion)}</div>
                <p><strong>Reasoning:</strong></p>
                <div class="formatted-ai-response">${formatAIResponseWithAsterisks(rec.reasoning)}</div>
            `;
            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            grid.appendChild(card);
        });
        recommendationsSection.appendChild(grid);
        resultsContainer.appendChild(recommendationsSection);
    }

    const keywordsSection = document.createElement('div');
    keywordsSection.className = 'analysis-section';
    const keywordsHeader = document.createElement('div');
    keywordsHeader.className = 'section-header';
    keywordsHeader.innerHTML = `<h2>Suggested SEO Tags (13)</h2>`;
    const copyTagsBtn = document.createElement('button');
    copyTagsBtn.id = 'copy-tags-btn';
    copyTagsBtn.className = 'copy-btn';
    copyTagsBtn.textContent = 'Copy Tags';
    copyTagsBtn.addEventListener('click', () => {
      const tagsToCopy = analysis.suggested_keywords.join(', ');
      navigator.clipboard.writeText(tagsToCopy).then(() => {
        copyTagsBtn.textContent = 'Copied!';
        setTimeout(() => { copyTagsBtn.textContent = 'Copy Tags'; }, 2000);
      });
    });
    keywordsHeader.appendChild(copyTagsBtn);
    const keywordsContainer = document.createElement('div');
    keywordsContainer.className = 'keywords-container';
    keywordsContainer.innerHTML = analysis.suggested_keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('');
    keywordsSection.appendChild(keywordsHeader);
    keywordsSection.appendChild(keywordsContainer);
    resultsContainer.appendChild(keywordsSection);

    const sourcesSection = document.createElement('div');
    sourcesSection.className = 'analysis-section';
    const sourcesHeader = document.createElement('div');
    sourcesHeader.className = 'section-header';
    sourcesHeader.innerHTML = `<h2>Sources Consulted</h2>`;
    const sourcesList = document.createElement('ul');
    sourcesList.className = 'sources-list';
    const sourcesHTML = analysis.sources && analysis.sources.length > 0
      ? analysis.sources.map(source => `
          <li class="source-item">
            <a href="${source.uri}" target="_blank" rel="noopener noreferrer">${source.title || source.uri}</a>
          </li>
        `).join('')
      : '<li>No external sources were cited for this analysis.</li>';
    sourcesList.innerHTML = sourcesHTML;
    sourcesSection.appendChild(sourcesHeader);
    sourcesSection.appendChild(sourcesList);
    resultsContainer.appendChild(sourcesSection);

    const nextStepsContainer = document.createElement('div');
    nextStepsContainer.id = 'next-steps-container';
    resultsContainer.appendChild(nextStepsContainer);

    const extraToolsResults = document.createElement('div');
    extraToolsResults.id = 'extra-tools-results';
    resultsContainer.appendChild(extraToolsResults);

    renderNextSteps();
}

const renderNextSteps = () => {
    const nextStepsContainer = document.getElementById('next-steps-container');
    if (!nextStepsContainer) return;
    nextStepsContainer.innerHTML = `
      <div class="analysis-section next-steps-header">
        <div class="section-header"><h2>Next Steps</h2></div>
        <p>Use your optimized listing to create marketing assets.</p>
        <div class="actions-container">
            <button id="ab-test-btn" class="action-btn"><span class="btn-text">Create A/B Tests</span></button>
            <button id="promo-btn" class="action-btn"><span class="btn-text">Draft Promo Content</span></button>
            <button id="faq-btn" class="action-btn"><span class="btn-text">Generate FAQs</span></button>
        </div>
      </div>
    `;
    document.getElementById('ab-test-btn')?.addEventListener('click', handleABTestGeneration);
    document.getElementById('promo-btn')?.addEventListener('click', handlePromoGeneration);
    document.getElementById('faq-btn')?.addEventListener('click', handleFAQGeneration);
}

const displayABTests = (variations: ABTestVariation[]) => {
    const container = document.getElementById('extra-tools-results');
    if(!container) return;
    const variationsHTML = variations.map((v, i) => `
        <div class="recommendation-card ab-test-card">
            <div class="recommendation-header"><h4>Variation ${i + 1}</h4></div>
            <div class="recommendation-body">
                <p><strong>Title:</strong> ${v.title}</p>
                <p><strong>Description:</strong></p>
                <div class="formatted-ai-response">${formatAIResponseWithAsterisks(v.description)}</div>
            </div>
        </div>`).join('');
    const abTestSection = document.createElement('div');
    abTestSection.className = 'analysis-section';
    abTestSection.innerHTML = `
        <div class="section-header"><h2>A/B Test Variations</h2></div>
        <p>Different versions of your title and description to test for higher conversion.</p>
        <div class="recommendations-grid">${variationsHTML}</div>`;
    container.prepend(abTestSection);
}

const displayPromoContent = (content: PromoContent) => {
    const container = document.getElementById('extra-tools-results');
    if(!container) return;
    const promoSection = document.createElement('div');
    promoSection.className = 'analysis-section';
    promoSection.innerHTML = `
        <div class="section-header"><h2>Promotional Content</h2></div>
        <p>Ready-to-use copy for your social media and email campaigns.</p>
        <div class="recommendations-grid">
            <div class="recommendation-card promo-card">
                <div class="recommendation-header">
                    <h4>Instagram Post</h4>
                    <button class="copy-btn" data-copy-target="instagram-copy">Copy</button>
                </div>
                <div class="recommendation-body"><pre id="instagram-copy">${content.instagram_post}</pre></div>
            </div>
            <div class="recommendation-card promo-card">
                <div class="recommendation-header">
                    <h4>Promotional Email</h4>
                    <button class="copy-btn" data-copy-target="email-copy">Copy</button>
                </div>
                <div class="recommendation-body"><pre id="email-copy">${content.promotional_email}</pre></div>
            </div>
        </div>`;
    container.prepend(promoSection);
    container.querySelectorAll('.promo-card .copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLElement;
            const targetId = btn.dataset.copyTarget;
            if (targetId) {
                const textToCopy = document.getElementById(targetId)?.innerText;
                if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        btn.textContent = 'Copied!';
                        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
                    });
                }
            }
        });
    });
}

const displayFAQs = (faqs: FAQItem[]) => {
    const container = document.getElementById('extra-tools-results');
    if(!container) return;
    currentFAQs = faqs;
    const faqItemsHTML = faqs.map((faq) => `
        <details class="faq-item">
            <summary class="faq-question">
                <span>${faq.question}</span>
                <button class="copy-btn" data-copy-text="${faq.answer.replace(/"/g, '&quot;')}">Copy Answer</button>
            </summary>
            <div class="faq-answer">
                 <div class="formatted-ai-response">${formatAIResponseWithAsterisks(faq.answer)}</div>
            </div>
        </details>`).join('');
    const faqSection = document.createElement('div');
    faqSection.className = 'analysis-section';
    faqSection.innerHTML = `
        <div class="section-header"><h2>Frequently Asked Questions</h2></div>
        <p>Address customer concerns upfront and improve your listing's SEO.</p>
        <div class="faq-container">${faqItemsHTML}</div>`;
    container.prepend(faqSection);
    faqSection.querySelectorAll('.faq-question .copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const btn = e.currentTarget as HTMLElement;
            const textToCopy = btn.dataset.copyText;
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = 'Copy Answer'; }, 2000);
                });
            }
        });
    });
}

// --- Action Handlers (Frontend) ---

const handleABTestGeneration = async (e: Event) => {
    if (!currentAnalysis || !originalListing) return;
    const button = e.currentTarget as HTMLButtonElement;
    setButtonLoading(button, true, 'Create A/B Tests');
    try {
        const response = await fetch('/api/ab-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalListing, analysis: currentAnalysis })
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const result = await response.json();
        displayABTests(result.variations);
        button.style.display = 'none';
    } catch(error) {
        console.error("A/B test generation failed:", error);
        displayError('Sorry, there was an error generating A/B tests.');
    } finally {
        setButtonLoading(button, false, 'Create A/B Tests');
    }
};

const handlePromoGeneration = async (e: Event) => {
    if (!currentAnalysis || !originalListing) return;
    const button = e.currentTarget as HTMLButtonElement;
    setButtonLoading(button, true, 'Draft Promo Content');
    try {
        const response = await fetch('/api/promo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis: currentAnalysis })
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const result = await response.json();
        displayPromoContent(result);
        button.style.display = 'none';
    } catch(error) {
        console.error("Promo content generation failed:", error);
        displayError('Sorry, there was an error generating promotional content.');
    } finally {
        setButtonLoading(button, false, 'Draft Promo Content');
    }
};

const handleFAQGeneration = async (e: Event) => {
    if (!currentAnalysis || !originalListing) return;
    const button = e.currentTarget as HTMLButtonElement;
    setButtonLoading(button, true, 'Generate FAQs');
    try {
        const response = await fetch('/api/faq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis: currentAnalysis })
        });
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        const result = await response.json();
        displayFAQs(result.faqs);
        button.style.display = 'none';
    } catch(error) {
        console.error("FAQ generation failed:", error);
        displayError('Sorry, there was an error generating FAQs.');
    } finally {
        setButtonLoading(button, false, 'Generate FAQs');
    }
};

// --- Main Application Logic ---

const main = () => {
  renderApp();
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
  const listingInput = document.getElementById('listing-input') as HTMLTextAreaElement;
  const resultsContainer = document.getElementById('results-container');
  const yearSpan = document.getElementById('year');
  if (!generateBtn || !listingInput || !resultsContainer || !yearSpan) {
    console.error('UI elements not found. App cannot start.');
    return;
  }
  yearSpan.textContent = new Date().getFullYear().toString();

  const handleInitialGeneration = async () => {
    originalListing = listingInput.value.trim();
    if (!originalListing) {
      displayError('Please paste your product listing to get started.');
      return;
    }
    setButtonLoading(generateBtn, true, 'Analyze Listing');
    if(resultsContainer) resultsContainer.innerHTML = '';
    
    try {
      const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ listing: originalListing })
      });
      if (!response.ok) {
          throw new Error(`The server returned an error: ${response.statusText}`);
      }
      
      const content = await response.text();
      const sourcesHeader = response.headers.get('x-sources');
      const sources = sourcesHeader ? JSON.parse(decodeURIComponent(sourcesHeader)) : [];
      
      if (content) {
        const analysis = parseAnalysisFromText(content);
        analysis.sources = sources;
        displayResults(analysis);
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
};

main();
    