<?php
/**
 * Plugin Name: wp-ui demo
 */
define( 'DEMO_UI_DIR', plugin_dir_path( __FILE__ ) );
define( 'DEMO_UI_URL', plugin_dir_url( __FILE__ ) );
require_once DEMO_UI_DIR . 'includes/class-demo-ui.php';
add_shortcode( 'wpui_demo', static function ( $atts ) {
	$name = 'Heinrich';
	return Demo_UI::mount( 'hello', array( 'name' => $name ), '<p>Hello ' . esc_html( $name ) . '</p>' );
} );
