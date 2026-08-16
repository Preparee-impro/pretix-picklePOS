$(function () {
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
        $('#checkout-btn').prop('disabled', !hasItems);
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
            data: JSON.stringify({ 'cart': orderData }),
            success: function (response) {
                showMessage('success', 'Order <strong>' + response.order_code + '</strong> created successfully!');

                // Reset UI
                $('.item-qty').val(0);
                updateCart();
                $btn.text('Checkout (Cash)');
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
        setTimeout(function() {
            $messages.empty();
        }, 5000);
    }
});