# Product URL policy

Product canonical URLs use `/product/{product-id}/{slug}`. The product ID is the route identity; the slug is descriptive only. Adding, removing, or changing the status of another product cannot change which product owns a canonical URL. Published product pages and sitemap entries use this same route.

The previous `/product/{product-id}` form remains available as a compatibility alias and renders the matching product with the new canonical URL.

Slug-only URLs such as `/product/shared-name` are not resolved by guessing from the current catalog. A slug may have belonged to a different product before a collision, removal, or status change, and the current catalog cannot recover that historical owner. Such requests show the not-found state (and are not indexed) instead of being sent to another product. Preserving and redirecting historical slug-only URLs would require a separately stored URL-history map.
