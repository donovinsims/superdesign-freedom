// Simple overlay for component selection
let overlay;
let selectedElement;
let isSelecting = false;

function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'superdesign-overlay';
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.background = 'rgba(0, 100, 255, 0.1)';
    overlay.style.border = '2px solid #0064ff';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'none';
    overlay.style.transition = 'all 0.1s ease';
    document.body.appendChild(overlay);
}

function handleMouseMove(e) {
    if (!isSelecting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement || el === overlay) return;

    selectedElement = el;
    const rect = el.getBoundingClientRect();

    if (!overlay) createOverlay();

    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
}

function getComputedStyles(el) {
    const styles = window.getComputedStyle(el);
    const relevantStyles = {};
    // Basic list of styles to capture - in a real app this would be more comprehensive
    const properties = [
        'display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height',
        'margin', 'padding', 'border', 'background', 'color', 'font-family', 'font-size',
        'font-weight', 'line-height', 'text-align', 'flex', 'grid', 'gap', 'border-radius',
        'box-shadow', 'opacity', 'z-index', 'transform'
    ];

    for (const prop of properties) {
        const val = styles.getPropertyValue(prop);
        if (val && val !== 'none' && val !== 'auto' && val !== 'normal' && val !== '0px') {
            relevantStyles[prop] = val;
        }
    }
    return relevantStyles;
}

function handleClick(e) {
    if (!isSelecting) return;
    e.preventDefault();
    e.stopPropagation();

    if (selectedElement) {
        const html = selectedElement.outerHTML;
        const styles = getComputedStyles(selectedElement);

        const data = {
            html,
            styles,
            tagName: selectedElement.tagName.toLowerCase(),
            rect: selectedElement.getBoundingClientRect()
        };

        // Send to background or copy to clipboard
        navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
            alert('Component copied to clipboard!');
        });

        cleanup();
    }
}

function cleanup() {
    isSelecting = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);
    if (overlay) {
        overlay.style.display = 'none';
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_SELECTION') {
        isSelecting = true;
        createOverlay();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('click', handleClick, true);
    } else if (request.action === 'CLONE_PAGE') {
        const fullHtml = document.documentElement.outerHTML;
        // Capture computed styles for body and key elements could be added here
        console.log('Cloning page...');
        chrome.runtime.sendMessage({ type: 'CLONE_DATA', data: { html: fullHtml, url: window.location.href } });
        alert('Full page cloned! (Check console/background)');
    }
});
