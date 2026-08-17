$(function () {
    // Original values for editing an order
    var currentEditOrder = null;
    var currentOriginalTotal = 0.0;

    // Handle the + and - button clicks
    $('.qty-btn').on('click', function () {
        var action = $(this).data('action');
        var $input = $(this).closest('.input-group').find('.item-qty');
        var currentVal = parseInt($input.val(), 10) || 0;

        if (action === 'plus') {
            $input.val(currentVal + 1);
        } else if (action === 'minus' && currentVal > 0) {
            $input.val(currentVal - 1);
        }

        // Recalculate the cart after any change
        updateCart();
    });

    // Handle direct typing into the input field
    $('.item-qty').on('input', function () {
        // Prevent negative numbers from being manually typed
        if ($(this).val() < 0) {
            $(this).val(0);
        } else if ($(this).val() > 99) {
            $(this).val(99);
        }

        // Recalculate the cart
        updateCart();
    });

    // Clean up the field when the user clicks away (if they left it empty)
    $('.item-qty').on('blur', function () {
        if ($(this).val() === '' || isNaN(parseInt($(this).val(), 10))) {
            $(this).val(0);
            updateCart();
        }
    });

    function updateCart() {
        var $cartItems = $('#cart-items');
        var total = 0.0;
        var hasItems = false;

        // Clear the current visual cart
        $cartItems.empty();

        // Loop through all inputs to find ones with a quantity > 0
        $('.item-qty').each(function () {
            var qty = parseInt($(this).val(), 10) || 0;

            if (qty > 0) {
                hasItems = true;
                var name = $(this).data('name');
                var price = parseFloat($(this).data('price')) || 0.0;
                var lineTotal = qty * price;
                total += lineTotal;

                // Add the item to the cart summary
                var $listItem = $('<li>', { class: 'list-group-item' });
                var $qty = $('<strong>', { text: qty + 'x' });
                var $price = $('<span>', { class: 'pull-right', text: lineTotal.toFixed(2) });

                // Append them together
                $listItem.append(
                    $qty,
                    document.createTextNode(' ' + name + ' '),
                    $price
                );

                $cartItems.append($listItem);
            }
        });

        // Update total price and toggle the checkout button
        $('#cart-total').text(total.toFixed(2));        

        // Handle Edit Mode differences
        var btnText;
        var isDisabled;
        if (currentEditOrder) {
            // Update and show Already Paid row
            $('#cart-already-paid').text(currentNetPaid.toFixed(2));
            $('#cart-already-paid-row').show();

            // Difference between new cart total and what was already paid
            var diff = total - currentNetPaid;
            $('#cart-difference').text(diff.toFixed(2));
            $('#cart-difference-row').show();

            // Positive or negative difference
            var diffText;
            if (diff >= 0) {
                var diffFormatted = diff.toFixed(2);
                diffText = interpolate(gettext('(Pay +%s)'), [diffFormatted]);
            } else {
                var diffFormatted = Math.abs(diff).toFixed(2);
                diffText = interpolate(gettext('(Refund %s)'), [diffFormatted]);
            }

            // Set text and disabled state for edit mode
            btnText = " " + interpolate(gettext("Update Order %s"), [diffText]);
            isDisabled = false;
        } else {
            // Hide extra rows for new orders
            $('#cart-already-paid-row').hide();
            $('#cart-difference-row').hide();

            // Set text and disabled state for new order mode
            btnText = " " + gettext('Checkout (Cash)');
            isDisabled = !hasItems;
        }

        // Common button DOM update logic
        var $icon = $('<i>', { class: 'fa fa-check' });

        $('#checkout-btn')
            .prop('disabled', isDisabled)
            .empty()
            .append($icon)
            .append(btnText);
    }

    // Handle the Checkout button click
    $('#checkout-btn').on('click', function (e) {
        e.preventDefault();

        // Disable button to prevent double-clicks
        var $btn = $(this);
        $btn.prop('disabled', true).text(gettext('Processing...'));

        var orderData = [];

        // Collect all items that have a quantity > 0
        $('.item-qty').each(function () {
            var qty = parseInt($(this).val(), 10) || 0;
            if (qty > 0) {
                orderData.push({
                    'item': $(this).data('item-id'),
                    'variation': $(this).data('variation-id') || null,
                    'qty': qty
                });
            }
        });

        // Grab the CSRF token from the page
        var csrfToken = $('input[name="csrfmiddlewaretoken"]').val();
        var checkoutUrl = $btn.data('checkout-url');

        // Send the data to our Django backend
        $.ajax({
            url: checkoutUrl,
            type: 'POST',
            headers: {
                'X-CSRFToken': csrfToken
            },
            contentType: 'application/json',
            data: JSON.stringify({
                'cart': orderData,
                'edit_order_code': currentEditOrder
            }),
            success: function (response) {
                showMessage('success', response.message);

                // Full reset of the POS interface
                currentEditOrder = null;
                currentNetPaid = 0.0;
                $('#edit-mode-banner').slideUp();
                $('#search-results-container').slideUp().empty();
                $('#order-search-input').val('');

                // Reset all quantities to 0
                $('.item-qty').val(0);
                updateCart();

                // Disable button
                $btn.prop('disabled', true)
            },
            error: function (xhr, status, error) {
                var errorMessage = gettext('Error submitting order.');
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage += ' ' + xhr.responseJSON.error;
                }
                showMessage('danger', errorMessage);
                console.error(xhr.responseText);

                // Re-enable button
                $btn.prop('disabled', false)
            },
            complete: function () {
                var $icon = $('<i>', { class: 'fa fa-check' });
                var btnText = " " + gettext('Checkout (Cash)');
                $btn.empty()
                    .append($icon)
                    .append(btnText)
            }
        });
    });

    function showMessage(type, message) {
        const $messages = $('#pos-messages');

        // Create the close button
        const $icon = $('<span>', { 'aria-hidden': 'true' }).html('&times;');
        const $closeBtn = $('<button>', {
            type: 'button',
            class: 'close',
            'data-dismiss': 'alert',
            'aria-label': 'Close'
        }).append($icon);

        // Create the alert div, append the button, and safely append the text message
        const $alert = $('<div>', {
            class: `alert alert-${type} alert-dismissible`,
            role: 'alert'
        }).append($closeBtn, document.createTextNode(message));

        // Clear previous messages and append the new alert
        $messages.empty().append($alert);

        // Auto-remove the alert after 7 seconds
        setTimeout(function () {
            $alert.remove(); // Removes just this specific alert instead of emptying the whole container
        }, 7000);
    }

    // Handle Order Search
    $('#order-search-btn').on('click', function () {
        var $searchBtn = $(this); // Capture the button reference
        var query = $('#order-search-input').val();
        var searchUrl = $searchBtn.data('search-url');
        var $resultsContainer = $('#search-results-container');

        if (query.length < 2) {
            showMessage('warning', gettext('Please enter at least 2 characters to search.'));
            return;
        }

        $resultsContainer.empty().hide();

        // Disable the button to prevent multiple clicks
        $searchBtn.prop('disabled', true);

        $.ajax({
            url: searchUrl,
            type: 'GET',
            data: { 'q': query },
            success: function (response) {
                if (response.results.length === 0) {
                    showMessage('info', gettext('No active orders found matching your search.'));
                    return;
                }

                $.each(response.results, function (index, order) {
                    // Decide what to display for the customer identity
                    var identity = order.name;
                    if (!identity) {
                        identity = order.email || gettext('No name or email');
                    } else if (order.email) {
                        // If they have both, show Name (Email)
                        identity += ' (' + order.email + ')';
                    }

                    // Create the badge element
                    var $badge = $('<span>', {
                        'class': 'pull-right badge',
                        text: order.total + ' ' + order.currency
                    });

                    // Check order status
                    if (order.status === 'n') {
                        $badge.addClass('unpaid-badge');
                    } else if (order.status === 'c') {
                        $badge.addClass('canceled-badge');
                    }

                    // Create the order code element
                    var $orderCode = $('<strong>', {
                        text: order.code
                    });

                    // Create the button and append the child elements and text nodes
                    var $btn = $('<button>', {
                        type: 'button',
                        'class': 'list-group-item load-order-btn',
                        'data-order-code': order.code
                    }).append($orderCode)
                        .append(' - ' + identity + ' ')
                        .append($badge);

                    // Append the newly constructed button to the DOM
                    $resultsContainer.append($btn);
                });

                $resultsContainer.slideDown();
            },
            error: function (xhr) {
                showMessage('danger', gettext('Error searching for orders.'));
                console.error(xhr.responseText);
            },
            complete: function () {
                // Re-enable the button once the request finishes
                $searchBtn.prop('disabled', false);
            }
        });
    });

    // Allow hitting Enter to search
    $('#order-search-input').on('keypress', function (e) {
        if (e.which === 13) {
            $('#order-search-btn').click();
        }
    });

    // Search after user stops typing
    var searchTimeout;
    $('#order-search-input').on('keyup', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
            $('#order-search-btn').click();
        }, 500); // delay in ms
    });

    // Handle clicking an order from the search results
    $('#search-results-container').on('click', '.load-order-btn', function () {
        var orderCode = $(this).data('order-code');
        var loadUrl = $('#order-search-btn').data('load-url');

        $.ajax({
            url: loadUrl,
            type: 'GET',
            data: { 'code': orderCode },
            success: function (response) {
                // Set global edit state
                currentEditOrder = response.code;
                currentNetPaid = parseFloat(response.net_paid) || 0.0; // Use net paid here

                // Show Edit Banner and update text
                $('#edit-order-code-display').text(currentEditOrder);
                $('#edit-original-total').text(parseFloat(response.current_total).toFixed(2));
                $('#edit-mode-banner').slideDown();

                // Hide search results and clear search input
                $('#search-results-container').slideUp();
                $('#order-search-input').val('');

                // Reset all quantities to 0 first
                $('.item-qty').val(0);

                // Pre-populate quantities from the order
                $.each(response.positions, function (index, pos) {
                    var varId = pos.variation_id || '';
                    $('input[data-item-id="' + pos.item_id + '"][data-variation-id="' + varId + '"]').val(pos.qty);
                });

                // Recalculate cart
                updateCart();
            },
            error: function (xhr) {
                showMessage('danger', gettext('Error loading order details.'));
            }
        });
    });

    // Handle canceling the edit mode
    $('#cancel-edit-btn').on('click', function () {
        currentEditOrder = null;
        currentNetPaid = 0.0;
        $('#edit-mode-banner').slideUp();
        $('#cart-already-paid-row').hide();
        $('#cart-difference-row').hide();
        $('.item-qty').val(0); // Reset UI
        updateCart();
    });

    // Handle canceling the actual order
    $('#cancel-order-btn').on('click', function () {
        if (!currentEditOrder) return;

        // Ask for confirmation before doing something destructive
        if (!confirm(gettext('Are you sure you want to completely cancel this order? This action cannot be undone.'))) {
            return;
        }

        var $btn = $(this);
        var cancelUrl = $btn.data('cancel-url');
        var csrfToken = $('input[name="csrfmiddlewaretoken"]').val();

        // Disable button while processing
        $btn.prop('disabled', true).text(gettext('Canceling...'));

        $.ajax({
            url: cancelUrl,
            type: 'POST',
            headers: {
                'X-CSRFToken': csrfToken
            },
            contentType: 'application/json',
            data: JSON.stringify({
                'order_code': currentEditOrder
            }),
            success: function (response) {
                showMessage('success', response.message || gettext('Order successfully canceled.'));

                // Full reset of the POS interface
                currentEditOrder = null;
                currentNetPaid = 0.0;
                $('#edit-mode-banner').slideUp();
                $('#cart-already-paid-row').hide();
                $('#cart-difference-row').hide();
                $('.item-qty').val(0);
                updateCart();
            },
            error: function (xhr) {
                var errorMessage = gettext('Error canceling order.');
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage += ' ' + xhr.responseJSON.error;
                }
                showMessage('danger', errorMessage);
            },
            complete: function () {
                // Restore button state
                var $icon = $('<i>', { class: 'fa fa-ban' });
                var btnText = " " + gettext('Cancel Order');
                $btn.prop('disabled', false)
                    .empty()
                    .append($icon)
                    .append(btnText)
            }
        });
    });
});