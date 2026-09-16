import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
        "SUPABASE_URL or SUPABASE_SECRET_KEY is missing"
    );
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type"]
    })
);

app.use(express.json());

const ALLOWED_TABLES = new Set([
    "cezoogroceries",
    "fresh_products",
    "icecreams",
    "delivery_cash_orders",
    "delivery_upi_orders",
    "upi_orders",
    "reported_issues",
    "cash_delivery_orders"
]);

const ORDERS_TABLE = "cash_delivery_orders";

app.get("/", (req, res) => {
    return res.json({
        success: true,
        message: "CEZOO API is running"
    });
});

app.get(
    "/api/table/:tableName",
    async (req, res) => {
        try {
            const tableName =
                req.params.tableName;

            if (!ALLOWED_TABLES.has(tableName)) {
                return res.status(400).json({
                    success: false,
                    message: "Table is not allowed"
                });
            }

            const page = Math.max(
                Number.parseInt(req.query.page, 10) || 1,
                1
            );

            const limit = Math.min(
                Math.max(
                    Number.parseInt(
                        req.query.limit,
                        10
                    ) || 12,
                    1
                ),
                50
            );

            const from =
                (page - 1) * limit;

            const to =
                from + limit - 1;

            const {
                data,
                error,
                count
            } = await supabase
                .from(tableName)
                .select("*", {
                    count: "exact"
                })
                .order("id", {
                    ascending: true
                })
                .range(from, to);

            if (error) {
                console.error(
                    "Supabase table error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });
            }

            const total = count || 0;

            return res.json({
                success: true,
                table: tableName,
                page,
                limit,
                total,
                hasMore:
                    to + 1 < total,
                data: data || []
            });

        } catch (error) {
            console.error(
                "Load table error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Unable to load products"
            });
        }
    }
);

app.post(
    "/api/table/:tableName/ids",
    async (req, res) => {
        try {
            const tableName =
                req.params.tableName;

            const ids =
                req.body?.ids;

            if (!ALLOWED_TABLES.has(tableName)) {
                return res.status(400).json({
                    success: false,
                    message: "Table is not allowed"
                });
            }

            if (
                !Array.isArray(ids) ||
                ids.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "ids array is required"
                });
            }

            const cleanIds = [
                ...new Set(
                    ids
                        .map(Number)
                        .filter(Number.isInteger)
                )
            ];

            if (cleanIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "No valid product IDs supplied"
                });
            }

            const {
                data,
                error
            } = await supabase
                .from(tableName)
                .select("*")
                .in("id", cleanIds);

            if (error) {
                console.error(
                    "Supabase IDs error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });
            }

            return res.json({
                success: true,
                table: tableName,
                count:
                    data?.length || 0,
                data: data || []
            });

        } catch (error) {
            console.error(
                "Product IDs error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Unable to load cart products"
            });
        }
    }
);


/*
 * UPDATE ONE RECORD
 * PATCH /api/table/:tableName/:id
 *
 * Example:
 * PATCH /api/table/fresh_products/12
 * Body: { "name": "Apple", "discount_price": 99 }
 */
app.patch(
    "/api/table/:tableName/:id",
    async (req, res) => {
        try {
            const tableName =
                req.params.tableName;

            const recordId =
                Number.parseInt(
                    req.params.id,
                    10
                );

            if (!ALLOWED_TABLES.has(tableName)) {
                return res.status(400).json({
                    success: false,
                    message: "Table is not allowed"
                });
            }

            if (
                !Number.isInteger(recordId) ||
                recordId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "A valid record ID is required"
                });
            }

            const updates =
                req.body;

            if (
                !updates ||
                typeof updates !== "object" ||
                Array.isArray(updates) ||
                Object.keys(updates).length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Update data is required"
                });
            }

            /*
             * Never allow the frontend to modify protected columns.
             * Add more protected column names here when needed.
             */
            const PROTECTED_FIELDS = new Set([
                "id",
                "created_at"
            ]);

            const cleanUpdates =
                Object.fromEntries(
                    Object.entries(updates)
                        .filter(
                            ([field, value]) =>
                                !PROTECTED_FIELDS.has(field) &&
                                value !== undefined
                        )
                );

            if (
                Object.keys(cleanUpdates).length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "No valid fields were supplied for update"
                });
            }

            const {
                data,
                error
            } = await supabase
                .from(tableName)
                .update(cleanUpdates)
                .eq("id", recordId)
                .select("*")
                .maybeSingle();

            if (error) {
                console.error(
                    "Supabase update error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });
            }

            if (!data) {
                return res.status(404).json({
                    success: false,
                    message: "Record not found"
                });
            }

            return res.json({
                success: true,
                message:
                    "Record updated successfully",
                table: tableName,
                data
            });

        } catch (error) {
            console.error(
                "Update record error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Unable to update record"
            });
        }
    }
);

app.get(
    "/api/orders/test",
    (req, res) => {
        return res.json({
            success: true,
            message:
                "Cash delivery orders route is working",
            table: ORDERS_TABLE
        });
    }
);

app.post(
    "/api/orders",
    async (req, res) => {
        try {
            const order =
                req.body || {};

            const requiredFields = [
                "order_id",
                "user_name",
                "user_mobile",
                "address",
                "latitude",
                "longitude",
                "items",
                "total_items",
                "delivery_mode",
                "total_amount"
            ];

            const missingFields =
                requiredFields.filter(
                    field => {
                        const value =
                            order[field];

                        return (
                            value === undefined ||
                            value === null ||
                            value === ""
                        );
                    }
                );

            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Missing required fields: " +
                        missingFields.join(", ")
                });
            }

            if (
                !Array.isArray(order.items) ||
                order.items.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Order items are required"
                });
            }

            const cleanItems =
                order.items
                    .map(item => ({
                        qty:
                            Number(item.qty || 0),

                        product_id:
                            Number(
                                item.product_id ??
                                item.id
                            ),

                        product_table:
                            String(
                                item.product_table ??
                                item.table ??
                                ""
                            )
                    }))
                    .filter(item =>
                        Number.isInteger(
                            item.product_id
                        ) &&
                        item.product_id > 0 &&
                        Number.isFinite(item.qty) &&
                        item.qty > 0 &&
                        item.product_table
                    );

            if (cleanItems.length === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "No valid order items found"
                });
            }

            if (
                ![
                    "instant",
                    "12_hours"
                ].includes(
                    order.delivery_mode
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid delivery mode"
                });
            }

            const latitude =
                Number(order.latitude);

            const longitude =
                Number(order.longitude);

            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Valid latitude and longitude are required"
                });
            }

            const cleanOrder = {
                order_id:
                    String(order.order_id),

                user_name:
                    String(order.user_name),

                user_mobile:
                    String(order.user_mobile),

                device_token:
                    order.device_token || null,

                village:
                    order.village || null,

                address:
                    String(order.address),

                latitude,
                longitude,

                items:
                    cleanItems,

                total_items:
                    Number(
                        order.total_items || 0
                    ),

                mrp_total:
                    Number(
                        order.mrp_total || 0
                    ),

                item_total:
                    Number(
                        order.item_total || 0
                    ),

                delivery_mode:
                    order.delivery_mode,

                delivery_distance:
                    order.delivery_distance ===
                        null ||
                    order.delivery_distance ===
                        undefined
                        ? null
                        : Number(
                            order.delivery_distance
                        ),

                delivery_fee:
                    Number(
                        order.delivery_fee || 0
                    ),

                handling_fee:
                    Number(
                        order.handling_fee || 0
                    ),

                delivery_tip:
                    Number(
                        order.delivery_tip || 0
                    ),

                total_amount:
                    Number(
                        order.total_amount || 0
                    ),

                total_savings:
                    Number(
                        order.total_savings || 0
                    ),

                delivery_date:
                    order.delivery_date || null,

                delivery_time:
                    order.delivery_time || null,

                delivery_instructions:
                    Array.isArray(
                        order.delivery_instructions
                    )
                        ? order.delivery_instructions
                        : [],

                payment_method:
                    "cash_on_delivery",

                payment_status:
                    "pending",

                order_status:
                    "placed"
            };

            const {
                data,
                error
            } = await supabase
                .from(ORDERS_TABLE)
                .insert(cleanOrder)
                .select("*")
                .single();

            if (error) {
                console.error(
                    "Supabase order insert error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message
                });
            }

            return res.status(201).json({
                success: true,
                message:
                    "Order placed successfully",
                data
            });

        } catch (error) {
            console.error(
                "Create order error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Unable to create order"
            });
        }
    }
);


// ============================================================
// GET CUSTOMER ORDERS
// Browser calls Render only.
// Supabase secret key stays on Render.
// Returns real order items + product names + images.
// ============================================================

app.get(
    "/api/orders",
    async (req, res) => {
        try {
            const mobile = String(
                req.query.mobile ||
                req.query.user_mobile ||
                ""
            ).replace(/\D/g, "").slice(-10);

            if (!mobile) {
                return res.status(400).json({
                    success: false,
                    message: "mobile is required"
                });
            }

            const variants = [
                mobile,
                "91" + mobile,
                "+91" + mobile,
                "+91 " + mobile
            ];

            // Load both customer order tables.
            const [cashResult, upiResult] = await Promise.all([
                supabase
                    .from("cash_delivery_orders")
                    .select("*")
                    .in("user_mobile", variants),

                supabase
                    .from("upi_orders")
                    .select("*")
                    .in("user_mobile", variants)
            ]);

            if (cashResult.error) {
                throw cashResult.error;
            }

            if (upiResult.error) {
                throw upiResult.error;
            }

            const rawOrders = [
                ...(cashResult.data || []).map(order => ({
                    ...order,
                    _order_type: "cash"
                })),
                ...(upiResult.data || []).map(order => ({
                    ...order,
                    _order_type: "upi"
                }))
            ];

            rawOrders.sort((a, b) => {
                return (
                    new Date(b.created_at || 0).getTime() -
                    new Date(a.created_at || 0).getTime()
                );
            });

            // ------------------------------------------------
            // Product lookup cache
            // ------------------------------------------------

            const productCache = new Map();

            function parseItems(order) {
                const candidates = [
                    order.items,
                    order.order_items,
                    order.orderItems,
                    order.products,
                    order.cart_items,
                    order.cartItems,
                    order.items_json
                ];

                for (const value of candidates) {
                    if (Array.isArray(value)) {
                        return value;
                    }

                    if (typeof value === "string") {
                        try {
                            const parsed = JSON.parse(value);
                            if (Array.isArray(parsed)) {
                                return parsed;
                            }
                        } catch (_) {}
                    }
                }

                return [];
            }

            function getTable(item) {
                return String(
                    item.product_table ??
                    item.table_name ??
                    item.table ??
                    ""
                ).trim();
            }

            function getProductId(item) {
                const id = Number(
                    item.product_id ??
                    item.productId ??
                    item.id
                );

                return Number.isInteger(id) && id > 0
                    ? id
                    : null;
            }

            function getQty(item) {
                return Number(
                    item.qty ??
                    item.quantity ??
                    item.ordered_qty ??
                    item.count ??
                    1
                ) || 1;
            }

            // ------------------------------------------------
            // Collect product IDs by table
            // ------------------------------------------------

            const grouped = new Map();

            for (const order of rawOrders) {
                for (const item of parseItems(order)) {
                    const table = getTable(item);
                    const id = getProductId(item);

                    if (!table || !id) {
                        continue;
                    }

                    if (!grouped.has(table)) {
                        grouped.set(table, new Set());
                    }

                    grouped.get(table).add(id);
                }
            }

            // ------------------------------------------------
            // Fetch actual product records.
            // This gives name + image1 + price etc.
            // ------------------------------------------------

            for (const [table, idSet] of grouped.entries()) {

                const ids = [...idSet].filter(
                    id => !productCache.has(`${table}_${id}`)
                );

                if (!ids.length) {
                    continue;
                }

                const { data, error } = await supabase
                    .from(table)
                    .select("*")
                    .in("id", ids);

                if (error) {
                    console.error(
                        `Order product lookup failed (${table}):`,
                        error
                    );
                    continue;
                }

                for (const product of (data || [])) {
                    productCache.set(
                        `${table}_${product.id}`,
                        {
                            ...product,
                            product_table: table
                        }
                    );
                }
            }

            // ------------------------------------------------
            // Merge product details into every order item
            // ------------------------------------------------

            const orders = rawOrders.map(order => {

                const items = parseItems(order).map(item => {

                    const table = getTable(item);
                    const id = getProductId(item);
                    const qty = getQty(item);

                    const product =
                        table && id
                            ? productCache.get(
                                `${table}_${id}`
                            )
                            : null;

                    return {
                        ...item,

                        product_id:
                            id ??
                            item.product_id ??
                            null,

                        product_table:
                            table ||
                            item.product_table ||
                            null,

                        qty,

                        ordered_qty: qty,

                        // Real product details from database.
                        name:
                            product?.name ??
                            product?.product_name ??
                            item.name ??
                            item.product_name ??
                            item.productName ??
                            item.title ??
                            "Product",

                        name_telugu:
                            product?.name_telugu ??
                            product?.product_name_telugu ??
                            item.name_telugu ??
                            item.product_name_telugu ??
                            "",

                        image1:
                            product?.image1 ??
                            item.image1 ??
                            item.image ??
                            item.image_url ??
                            item.product_image ??
                            "",

                        image2:
                            product?.image2 ??
                            item.image2 ??
                            "",

                        image3:
                            product?.image3 ??
                            item.image3 ??
                            "",

                        unit:
                            product?.unit ??
                            item.unit ??
                            "",

                        original_price:
                            product?.original_price ??
                            item.original_price ??
                            item.price ??
                            0,

                        discount_price:
                            product?.discount_price ??
                            item.discount_price ??
                            item.price ??
                            0
                    };
                });

                return {
                    ...order,
                    items,
                    _items_loaded_from_products: true
                };
            });

            return res.json({
                success: true,
                count: orders.length,
                orders
            });

        } catch (error) {

            console.error(
                "GET /api/orders error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Unable to load customer orders"
            });
        }
    }
);


app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "Route not found",
        method: req.method,
        path: req.path
    });
});

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `CEZOO API running on port ${PORT}`
        );

        console.log(
            "Orders table:",
            ORDERS_TABLE
        );

        console.log(
            "Orders endpoint: POST /api/orders"
        );

        console.log(
            "Customer orders endpoint: GET /api/orders?mobile=XXXXXXXXXX"
        );
    }
);
