$(function() {
    var $marker = $('#picklepos-pay-at-entrance-marker');
    
    // If our marker exists on the page
    if ($marker.length > 0) {
        // Find the panel container that holds this marker and hide it completely
        $marker.closest('.panel-primary').hide();
    }
});