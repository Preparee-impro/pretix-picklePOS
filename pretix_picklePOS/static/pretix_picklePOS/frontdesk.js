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
});