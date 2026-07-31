import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();zoo
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

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

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
}));

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

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "CEZOO API is running"
    });
});

app.get("/api/table/:tableName", async (req, res) => {
    try {
        const tableName = req.params.tableName;

        if (!ALLOWED_TABLES.has(tableName)) {
            return res.status(400).json({
                success: false,
                message: "Table is not allowed"
            });
        }

        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                parseInt(req.query.limit) || 12,
                1
            ),
            50
        );

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await supabase
            .from(tableName)
            .select("*", {
                count: "exact"
            })
            .order("id", {
                ascending: true
            })
            .range(from, to);

        if (error) {
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
            hasMore: to + 1 < total,
            data: data || []
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post("/api/table/:tableName/ids", async (req, res) => {
    try {
        const tableName = req.params.tableName;
        const ids = req.body?.ids;

        if (!ALLOWED_TABLES.has(tableName)) {
            return res.status(400).json({
                success: false,
                message: "Table is not allowed"
            });
        }

        if (!Array.isArray(ids) || ids.length === 0) {
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

        const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .in("id", cleanIds);

        if (error) {
            console.error("Supabase error:", error);

            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        return res.json({
            success: true,
            table: tableName,
            count: data?.length || 0,
            data: data || []
        });

    } catch (error) {
        console.error("Server error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.path
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`CEZOO API running on port ${PORT}`);
});
