document.addEventListener('DOMContentLoaded', () => {
    // --- Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        // Register service worker relative to the current script's location
        // This is crucial for GitHub Pages projects hosted in subdirectories.
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }

    // --- PWA Install Prompt Logic ---
    let deferredPrompt;
    const installPromptContainer = document.getElementById('install-prompt-container');
    const installButton = document.getElementById('install-button');
    const closeInstallPromptButton = document.getElementById('close-install-prompt');

    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt event fired.'); // Debugging log
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI to notify the user they can add to home screen
        installPromptContainer.classList.remove('translate-y-full'); // Show the prompt
    });

    installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
            installPromptContainer.classList.add('translate-y-full'); // Hide the prompt
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, and can't use it again, clear it.
            deferredPrompt = null;
        }
    });

    closeInstallPromptButton.addEventListener('click', () => {
        installPromptContainer.classList.add('translate-y-full'); // Hide the prompt
    });


    // --- DOM Elements ---
    const currentExpressionDisplay = document.getElementById('current-expression');
    const currentResultDisplay = document.getElementById('current-result');
    const calculatorButtons = document.querySelectorAll('.calc-btn');
    const calculatorView = document.getElementById('calculator-view');
    const historyView = document.getElementById('history-view');
    const calculatorViewBtn = document.getElementById('calculator-view-btn');
    const historyViewBtn = document.getElementById('history-view-btn');

    const historyList = document.getElementById('history-list');
    const selectAllHistoryBtn = document.getElementById('select-all-history-btn');
    const deselectAllHistoryBtn = document.getElementById('deselect-all-history-btn');
    const clearAllHistoryBtn = document.getElementById('clear-all-history-btn');

    const billSubtotalLabelDisplay = document.getElementById('bill-subtotal-label'); // Label in UI
    const billSubtotalDisplay = document.getElementById('bill-subtotal');
    const billGrandTotalDisplay = document.getElementById('bill-grand-total');
    const generateBillBtn = document.getElementById('generate-bill-btn');

    const billContentTemplate = document.getElementById('bill-content-template');
    const toastMessageElement = document.getElementById('toast-message');

    const settingsIconBtn = document.getElementById('settings-icon-btn'); // Settings icon
    const settingsModal = document.getElementById('settings-modal'); // Settings modal
    const settingsModalCloseBtn = settingsModal.querySelector('.close-button'); // Settings modal close button
    const settingHeaderTitleInput = document.getElementById('setting-header-title');
    const settingSubtotalLabelInput = document.getElementById('setting-subtotal-label');
    const settingThankYouMessageInput = document.getElementById('setting-thank-you-message');
    const saveSettingsBtn = document.getElementById('save-settings-btn');


    // --- State Variables ---
    let currentExpression = '';
    let currentResult = '0';
    let lastActionWasEquals = false;
    let history = []; // Array of {id, expression, result, selected}
    let generatedBills = []; // Storing generated bill metadata, not displayed in UI anymore

    // Default settings for customization
    let settings = {
        billHeaderTitle: 'EXPENSE SUMMARY',
        billSubtotalLabel: 'সাবটোটাল:',
        billThankYouMessage: 'আপনার কেনাকাটার জন্য ধন্যবাদ!'
    };

    // --- Local Storage Management ---
    const loadState = () => {
        const storedHistory = localStorage.getItem('calculatorHistory');
        if (storedHistory) {
            history = JSON.parse(storedHistory);
            renderHistory();
        }
        const storedBills = localStorage.getItem('generatedBills');
        if (storedBills) {
            generatedBills = JSON.parse(storedBills);
        }
        const storedSettings = localStorage.getItem('billSettings');
        if (storedSettings) {
            settings = JSON.parse(storedSettings);
        }
        applySettingsToUI();
    };

    const saveState = () => {
        localStorage.setItem('calculatorHistory', JSON.stringify(history));
        localStorage.setItem('generatedBills', JSON.stringify(generatedBills));
        localStorage.setItem('billSettings', JSON.stringify(settings));
    };

    // --- Apply Settings to UI (Labels) ---
    const applySettingsToUI = () => {
        // Update settings modal inputs with current settings
        settingHeaderTitleInput.value = settings.billHeaderTitle;
        settingSubtotalLabelInput.value = settings.billSubtotalLabel;
        settingThankYouMessageInput.value = settings.billThankYouMessage;

        // Update live UI elements (subtotal label in history view)
        billSubtotalLabelDisplay.textContent = settings.billSubtotalLabel;

        // Update hidden bill template elements
        document.getElementById('bill-template-header-title').textContent = settings.billHeaderTitle;
        document.getElementById('bill-template-subtotal-label').textContent = settings.billSubtotalLabel;
        document.getElementById('bill-template-thank-you-message').textContent = settings.billThankYouMessage;
    };

    // --- Toast Message Functionality ---
    const showToastMessage = (message) => {
        toastMessageElement.textContent = message;
        toastMessageElement.classList.remove('opacity-0', 'pointer-events-none');
        toastMessageElement.classList.add('opacity-100');
        setTimeout(() => {
            toastMessageElement.classList.remove('opacity-100');
            toastMessageElement.classList.add('opacity-0', 'pointer-events-none');
        }, 3000);
    };

    // --- Calculator Logic ---
    const evaluateExpression = (expression) => {
        try {
            let formattedExpression = expression.replace(/×/g, '*').replace(/÷/g, '/');
            formattedExpression = formattedExpression.replace(/%/g, '/100'); // Simplified percentage handling for evaluation

            let finalExpression = formattedExpression.trim();

            // --- Robust Input Validation Before Evaluation ---
            if (finalExpression === '') return 'Error';

            const lastChar = finalExpression.slice(-1);
            if (['+', '-', '*', '/', '.', '%'].includes(lastChar)) { // Added % to operators
                console.warn("Evaluation rejected: Expression ends with an operator/decimal.", finalExpression);
                return 'Error';
            }

            if (finalExpression.match(/[\+\-\*\/]{2,}/)) {
                console.warn("Evaluation rejected: Consecutive operators found.", finalExpression);
                return 'Error';
            }

            if (finalExpression.length > 0 && ['*', '/', '+'].includes(finalExpression[0]) && finalExpression !== '-' ) {
                 console.warn("Evaluation rejected: Invalid starting operator.", finalExpression);
                 return 'Error';
            }

            if (!finalExpression.match(/^[\d\s\+\-\*\/\.%()]+$/)) { // Allow % in regex
                console.warn("Evaluation rejected: Invalid characters found.", finalExpression);
                return 'Error';
            }

            console.log("Attempting to evaluate:", finalExpression);
            const result = new Function('return ' + finalExpression)();
            console.log("Evaluation successful, result:", result);
            return isNaN(result) || !isFinite(result) ? 'Error' : parseFloat(result.toFixed(10));
        } catch (e) {
            console.error("Evaluation error during Function() construction:", e, "Expression was:", expression);
            return 'Error';
        }
    };

    const updateCalculatorDisplay = () => {
        currentExpressionDisplay.textContent = currentExpression;
        currentResultDisplay.textContent = currentResult;
    };

    const handleButtonClick = (event) => {
        const value = event.target.textContent;

        if (value === 'AC') {
            currentExpression = '';
            currentResult = '0';
            lastActionWasEquals = false;
        } else if (value === 'CE') {
            currentExpression = currentExpression.slice(0, -1); // Simple backspace
            currentResult = '0'; // Reset real-time result
            lastActionWasEquals = false;
        } else if (value === '=') {
            if (currentExpression === '') return;

            const finalResult = evaluateExpression(currentExpression);
            if (finalResult === 'Error') {
                currentResult = 'Error';
                currentExpression = ''; // Clear expression on error to prevent cascading issues
            } else {
                currentResult = String(finalResult);
                const newHistoryEntry = {
                    id: Date.now().toString() + Math.random().toString().slice(2, 6),
                    expression: currentExpression,
                    result: finalResult,
                    selected: false,
                };
                history.unshift(newHistoryEntry); // Add to the beginning
                saveState(); // Save after adding to history
                renderHistory();
                currentExpression = String(finalResult); // Set result as new expression start for chain operations
            }
            lastActionWasEquals = true;
        } else if (['+', '-', '×', '÷', '%'].includes(value)) {
            if (currentExpression === '' && value !== '-') {
                return; // Prevent starting with operator (except negative sign)
            }
            const lastChar = currentExpression.slice(-1);
            if (['+', '-', '×', '÷', '%', '.'].includes(lastChar)) {
                currentExpression = currentExpression.slice(0, -1) + value; // Replace last operator/dot
            } else {
                currentExpression += value;
            }
            currentResult = '0'; // Clear real-time result when operator is pressed
            lastActionWasEquals = false; // Reset equals flag
        } else if (value === '.') {
            const lastNumberMatch = currentExpression.match(/(\d+(\.\d+)?)$/);
            if (lastNumberMatch && lastNumberMatch[0].includes('.')) {
                return; // Already has a decimal in the current number
            }
            const lastChar = currentExpression.slice(-1);
            if (['+', '-', '×', '÷', '%'].includes(lastChar) || currentExpression === '') {
                currentExpression += '0.'; // Start with 0. if preceded by operator or empty
            } else if (lastChar === '.') {
                return; // Prevent multiple dots directly
            } else {
                currentExpression += value;
            }
            lastActionWasEquals = false; // Reset equals flag
        } else { // Number button
            if (lastActionWasEquals) {
                currentExpression = value; // Start new expression if after '='
                lastActionWasEquals = false;
            } else {
                currentExpression += value;
            }

            // Update real-time result
            const tempResult = evaluateExpression(currentExpression);
            if (tempResult !== 'Error') {
                currentResult = String(tempResult);
            } else {
                const lastChar = currentExpression.slice(-1);
                // If it's an incomplete expression (e.g. "5+") don't show "Error" immediately
                if (!['+', '-', '×', '÷', '%', '.'].includes(lastChar)) {
                    currentResult = 'Error'; // Show error for invalid intermediate expressions
                } else {
                    currentResult = '0'; // If incomplete but syntactically fine so far (e.g., "123+")
                }
            }
        }
        updateCalculatorDisplay();
    };

    calculatorButtons.forEach(button => {
        button.addEventListener('click', handleButtonClick);
    });

    // --- View Switching ---
    const showView = (viewId) => {
        if (viewId === 'calculator-view') {
            calculatorView.classList.remove('hidden');
            historyView.classList.add('hidden');
            calculatorViewBtn.classList.add('bg-[#1ABC9C]', 'text-white');
            calculatorViewBtn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
            historyViewBtn.classList.remove('bg-[#1ABC9C]', 'text-white');
            historyViewBtn.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
        } else {
            calculatorView.classList.add('hidden');
            historyView.classList.remove('hidden');
            historyViewBtn.classList.add('bg-[#1ABC9C]', 'text-white');
            historyViewBtn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
            calculatorViewBtn.classList.remove('bg-[#1ABC9C]', 'text-white');
            calculatorViewBtn.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
            renderHistory(); // Ensure history is updated when switching
            updateBillSummary(); // Update bill summary
        }
    };

    calculatorViewBtn.addEventListener('click', () => showView('calculator-view'));
    historyViewBtn.addEventListener('click', () => showView('history-view'));

    // --- History Management ---
    const renderHistory = () => {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<p class="text-gray-400 text-center">কোনো হিসাবের ইতিহাস নেই।</p>';
            return;
        }

        history.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between glass-panel rounded-md p-3 mb-2 shadow-sm'; // Applied glass-panel here
            div.innerHTML = `
                <input type="checkbox" data-id="${entry.id}" ${entry.selected ? 'checked' : ''}
                    class="form-checkbox h-5 w-5 text-[#1ABC9C] rounded-md border-gray-500 focus:ring-[#1ABC9C]">
                <span class="flex-1 mx-3 text-lg font-mono truncate">
                    ${entry.expression} = ${entry.result !== 'Error' ? entry.result.toFixed(2) : entry.result}
                </span>
                <button class="delete-history-item text-gray-400 hover:text-[#E74C3C] transition-colors" data-id="${entry.id}" aria-label="হিসাব মুছুন">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    `;
            historyList.appendChild(div);
        });

        // Attach event listeners for new elements
        historyList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => toggleHistorySelection(e.target.dataset.id));
        });
        historyList.querySelectorAll('.delete-history-item').forEach(button => {
            button.addEventListener('click', (e) => deleteHistoryItem(e.currentTarget.dataset.id));
        });
        updateBillSummary(); // Update summary whenever history changes
    };

    const toggleHistorySelection = (id) => {
        history = history.map(item =>
            item.id === id ? { ...item, selected: !item.selected } : item
        );
        saveState();
        renderHistory(); // Re-render to show updated checkbox state
    };

    const deleteHistoryItem = (id) => {
        history = history.filter(item => item.id !== id);
        saveState();
        renderHistory();
        showToastMessage('হিসাব মুছে ফেলা হয়েছে।');
    };

    const selectAllHistory = () => {
        history = history.map(item => ({ ...item, selected: true }));
        saveState();
        renderHistory();
    };

    const deselectAllHistory = () => {
        history = history.map(item => ({ ...item, selected: false }));
        saveState();
        renderHistory();
    };

    const clearAllHistory = () => {
        history = [];
        saveState();
        renderHistory();
        showToastMessage('সমস্ত ইতিহাস মুছে ফেলা হয়েছে।');
    };

    selectAllHistoryBtn.addEventListener('click', selectAllHistory);
    deselectAllHistoryBtn.addEventListener('click', deselectAllHistory);
    clearAllHistoryBtn.addEventListener('click', clearAllHistory);

    // --- Bill Summary Logic ---
    const updateBillSummary = () => {
        const selectedItems = history.filter(item => item.selected && item.result !== 'Error');
        const subtotal = selectedItems.reduce((sum, item) => sum + item.result, 0);
        const grandTotal = subtotal;

        billSubtotalDisplay.textContent = subtotal.toFixed(2);
        billGrandTotalDisplay.textContent = grandTotal.toFixed(2);
    };

    // --- Bill Generation & PNG Download ---
    const generateBill = async () => {
        const selectedForBill = history.filter(item => item.selected && item.result !== 'Error');

        if (selectedForBill.length === 0) {
            showToastMessage('বিল তৈরি করতে অনুগ্রহ করে অন্তত একটি হিসাব নির্বাচন করুন।');
            return;
        }

        // Populate the hidden bill template
        const billNumber = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const now = new Date();
        const dateString = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        document.getElementById('bill-template-bill-no').textContent = `Bill No: ${billNumber}`;
        document.getElementById('bill-template-date-time').textContent = `Date: ${dateString} Time: ${timeString}`;

        // Use current settings for bill content
        document.getElementById('bill-template-header-title').textContent = settings.billHeaderTitle;
        document.getElementById('bill-template-subtotal-label').textContent = settings.billSubtotalLabel;
        document.getElementById('bill-template-thank-you-message').textContent = settings.billThankYouMessage;


        const billItemsTableBody = billContentTemplate.querySelector('tbody');
        billItemsTableBody.innerHTML = ''; // Clear previous items

        selectedForBill.forEach((selectedItem) => {
            const expression = selectedItem.expression;
            // Regex to split by operators while keeping them, and handling leading negative sign
            const parts = expression.match(/(-?\d+(?:\.\d+)?%?)|([+\-×÷])/g); // Split by operators, keep them. Handle optional % for numbers.

            if (!parts) return;

            let descriptionPrefix = ''; // Holds the operator for the next number
            parts.forEach((part) => {
                let description = '';
                let amount = 0;

                if (part.match(/^-?\d+(?:\.\d+)?%?$/)) { // It's a number (possibly negative) or percentage
                    amount = parseFloat(part.replace('%', '')); // Get the raw number value for display
                    if (part.includes('%')) {
                        description = (descriptionPrefix ? descriptionPrefix + ' ' : '') + part; // Show " + 20%"
                        // For display amount, we show 20, not 0.2
                    } else {
                        description = (descriptionPrefix ? descriptionPrefix + ' ' : '') + part;
                    }
                    descriptionPrefix = ''; // Reset prefix after using it

                    // Add row for this number/percentage part
                    const row = document.createElement('tr');
                    row.style.borderBottom = '1px dotted #E0E0E0';
                    row.innerHTML = `
                        <td style="padding-top: 8px; padding-bottom: 8px; font-size: 14px;"></td>
                        <td style="padding-top: 8px; padding-bottom: 8px; font-size: 14px;">${description.trim()}</td>
                        <td style="padding-top: 8px; padding-bottom: 8px; text-align: right; font-size: 14px;">${amount.toFixed(2)}</td>
                    `;
                    billItemsTableBody.appendChild(row);
                } else { // It's an operator
                    descriptionPrefix = part;
                }
            });
            
            // Add a separator and the total for this specific calculation
            const totalRow = document.createElement('tr');
            totalRow.style.borderTop = '1px solid #999'; // A line to separate this calculation's parts
            totalRow.innerHTML = `
                <td colspan="2" style="padding-top: 8px; padding-bottom: 8px; font-size: 14px; text-align: right; font-weight: bold;">মোট (${expression} =):</td>
                <td style="padding-top: 8px; padding-bottom: 8px; font-size: 14px; text-align: right; font-weight: bold;">${selectedItem.result.toFixed(2)}</td>
            `;
            billItemsTableBody.appendChild(totalRow);
            billItemsTableBody.appendChild(document.createElement('tr')).innerHTML = `<td colspan="3" style="height:15px;"></td>`; // Empty row for spacing
        });


        const subtotalForBill = selectedForBill.reduce((sum, item) => sum + item.result, 0);
        const grandTotalForBill = subtotalForBill; 

        document.getElementById('bill-template-subtotal').textContent = subtotalForBill.toFixed(2);
        document.getElementById('bill-template-grand-total').textContent = grandTotalForBill.toFixed(2);

        // Make the hidden bill content visible (off-screen) for html2canvas
        billContentTemplate.style.position = 'absolute';
        billContentTemplate.style.left = '-9999px';
        billContentTemplate.style.top = '-9999px';
        billContentTemplate.style.zIndex = '-1';
        billContentTemplate.style.opacity = '1';
        billContentTemplate.style.display = 'block';

        // Give a short delay to ensure DOM is updated before capture
        setTimeout(async () => {
            try {
                console.log('html2canvas ক্যাপচার করার চেষ্টা করা হচ্ছে...');
                const canvas = await html2canvas(billContentTemplate, {
                    scale: 2, // Increase scale for higher resolution PNG
                    useCORS: true,
                    backgroundColor: null, // Transparent background
                    logging: true, // Enable logging for debugging
                });

                const imageDataUrl = canvas.toDataURL('image/png');
                console.log('html2canvas ক্যাপচার সফল হয়েছে। ছবি তৈরি করা হচ্ছে। ছবির ডেটা ইউআরএল দৈর্ঘ্য:', imageDataUrl.length);

                // Convert data URL to Blob and download
                const byteString = atob(imageDataUrl.split(',')[1]);
                const mimeString = imageDataUrl.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: mimeString });

                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Bill_No_${billNumber}.png`;
                document.body.appendChild(link); // Required for Firefox to work
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url); // Clean up the URL object

                showToastMessage('বিল গ্যালারিতে সংরক্ষিত হয়েছে!');

                // Add to generated bills log (data still stored even if not displayed)
                generatedBills.unshift({ billNumber, date: dateString, time: timeString, selectedCalculationIds: selectedForBill.map(item => item.id) });
                saveState();

                // Deselect all items after generating bill
                history = history.map(item => ({ ...item, selected: false }));
                saveState();
                renderHistory();

            } catch (error) {
                console.error('বিল তৈরি করার সময় বিস্তারিত ত্রুটি:', error);
                showToastMessage('বিল তৈরি করতে ব্যর্থ হয়েছে। বিস্তারিত তথ্যের জন্য কনসোল দেখুন।');
            } finally {
                // Hide the template div again
                billContentTemplate.style.display = 'none';
                billContentTemplate.style.position = '';
                billContentTemplate.style.left = '';
                billContentTemplate.style.top = '';
                billContentTemplate.style.zIndex = '';
                billContentTemplate.style.opacity = '';
            }
        }, 500); // 500ms delay for DOM rendering
    };

    generateBillBtn.addEventListener('click', generateBill);

    // --- Settings Modal Logic ---
    settingsIconBtn.addEventListener('click', () => {
        settingsModal.classList.add('show');
    });

    settingsModalCloseBtn.addEventListener('click', () => {
        settingsModal.classList.remove('show');
    });

    saveSettingsBtn.addEventListener('click', () => {
        settings.billHeaderTitle = settingHeaderTitleInput.value;
        settings.billSubtotalLabel = settingSubtotalLabelInput.value;
        settings.billThankYouMessage = settingThankYouMessageInput.value;
        saveState();
        applySettingsToUI();
        settingsModal.classList.remove('show');
        showToastMessage('সেটিংস সেভ করা হয়েছে!');
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.classList.remove('show');
        }
    });


    // --- Initial Load ---
    loadState();
    updateCalculatorDisplay(); // Initialize calculator display
    renderHistory(); // Initial render of history and bill summary
});
