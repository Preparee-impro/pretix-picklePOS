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

    // Clean up the field when the user clicks away (if they left it totally empty)
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
                var listItem = $('<li class="list-group-item"></li>');
                listItem.html('<strong>' + qty + 'x</strong> ' + name + ' <span class="pull-right">' + lineTotal.toFixed(2) + '</span>');
                $cartItems.append(listItem);
            }
        });

        // Update total price and toggle the checkout button
        $('#cart-total').text(total.toFixed(2));

        // Handle Edit Mode differences
        if (currentEditOrder) {
            // Update and show Already Paid row
            $('#cart-already-paid').text(currentNetPaid.toFixed(2));
            $('#cart-already-paid-row').show();

            // Difference between new cart total and what was already paid
            var diff = total - currentNetPaid;
            $('#cart-difference').text(diff.toFixed(2));
            $('#cart-difference-row').show();

            var btnText = diff >= 0 ? 'Update Order (Pay +' + diff.toFixed(2) + ')' : 'Update Order (Refund ' + diff.toFixed(2) + ')';
            $('#checkout-btn').text(btnText).prop('disabled', false);
        } else {
            $('#cart-already-paid-row').hide();
            $('#cart-difference-row').hide();
            $('#checkout-btn').text('Checkout (Cash)').prop('disabled', !hasItems);
        }
    }

    // Handle the Checkout button click
    $('#checkout-btn').on('click', function (e) {
        e.preventDefault();

        // Disable button to prevent double-clicks
        var $btn = $(this);
        $btn.prop('disabled', true).text('Processing...');

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
            success: function(response) {
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
                
                // Reset checkout button state and text
                $btn.prop('disabled', true).text('Checkout (Cash)');
            },
            error: function (xhr, status, error) {
                var errorMessage = 'Error submitting order.';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage += ' ' + xhr.responseJSON.error;
                }
                showMessage('danger', errorMessage);
                console.error(xhr.responseText);

                // Re-enable button
                $btn.prop('disabled', false).text('Checkout (Cash)');
            }
        });
    });

    function showMessage(type, message) {
        var alertHtml = '<div class="alert alert-' + type + ' alert-dismissible" role="alert">' +
            '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
            '<span aria-hidden="true">&times;</span></button>' +
            message + '</div>';

        var $messages = $('#pos-messages');
        $messages.html(alertHtml);

        // Auto-remove the alert after 5 seconds
        setTimeout(function () {
            $messages.empty();
        }, 5000);
    }

    // Handle Order Search
    $('#order-search-btn').on('click', function () {
        var query = $('#order-search-input').val();
        var searchUrl = $(this).data('search-url');
        var $resultsContainer = $('#search-results-container');

        if (query.length < 2) {
            showMessage('warning', 'Please enter at least 2 characters to search.');
            return;
        }

        $resultsContainer.empty().hide();

        $.ajax({
            url: searchUrl,
            type: 'GET',
            data: { 'q': query },
            success: function (response) {
                if (response.results.length === 0) {
                    showMessage('info', 'No active orders found matching your search.');
                    return;
                }

                $.each(response.results, function (index, order) {
                    // Decide what to display for the customer identity
                    var identity = order.name;
                    if (!identity) {
                        identity = order.email || 'No name or email';
                    } else if (order.email) {
                        // If they have both, show Name (Email)
                        identity += ' (' + order.email + ')';
                    }

                    // Check if the order is pending/unpaid (status n)
                    var badgeStyle = '';
                    if (order.status === 'n') {
                        // Use Bootstrap's standard yellow/warning color
                        badgeStyle = 'background-color: #f0ad4e; color: #fff;';
                    }

                    var btnHtml = '<button type="button" class="list-group-item load-order-btn" data-order-code="' + order.code + '">' +
                        '<strong>' + order.code + '</strong> - ' + identity +
                        ' <span class="pull-right badge" style="' + badgeStyle + '">' +
                        order.total + ' ' + order.currency +
                        '</span>' +
                        '</button>';
                    $resultsContainer.append(btnHtml);
                });

                $resultsContainer.slideDown();
            },
            error: function (xhr) {
                showMessage('danger', 'Error searching for orders.');
                console.error(xhr.responseText);
            }
        });
    });

    // Allow hitting "Enter" in the search box
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
                showMessage('danger', 'Error loading order details.');
            }
        });
    });

    // Handle canceling the edit mode
    $('#cancel-edit-btn').on('click', function() {
        currentEditOrder = null;
        currentNetPaid = 0.0;
        $('#edit-mode-banner').slideUp();
        $('#cart-already-paid-row').hide();
        $('#cart-difference-row').hide();
        $('.item-qty').val(0); // Reset UI
        updateCart();
    });
});