import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in Render environment variables."
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

app.use(cors());
app.use(express.json());

/*
Only these tables can be requested from the frontend.
Add more table names here when needed.
*/
const ALLOWED_TABLES = new Set([
    "cezoogroceris",
    "fresh_products",
    "icecreams",
    "delivery_cash_orders",
    "delivery_upi_orders",
    "upi_orders",
    "reported_issues",
    "cash_delivery_orders"
]);

/*
Health check:
https://YOUR-RENDER-URL.onrender.com/
*/
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "CEZOO API is running"
    });
});

/*
Load all rows from one approved table.

Example:
https://YOUR-RENDER-URL.onrender.com/api/table/fresh_products
https://YOUR-RENDER-URL.onrender.com/api/table/icecreams
*/
app.get("/api/table/:tableName", async (req, res) => {
    try {
        const tableName = req.params.tableName;

        if (!ALLOWED_TABLES.has(tableName)) {
            return res.status(400).json({
                success: false,
                message: "Table is not allowed"
            });
        }

        const { data, error } = await supabase
            .from(tableName)
            .select("*");

        if (error) {
            console.error(error);

            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            table: tableName,
            count: data.length,
            data
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

/*
Load selected IDs from one approved table.

Example:
POST /api/table/fresh_products/ids

Body:
{
    "ids": [2, 3, 4, 5]
}
*/
app.post("/api/table/:tableName/ids", async (req, res) => {
    try {
        const tableName = req.params.tableName;
        const ids = req.body.ids;

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
            console.error(error);

            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        const rowMap = new Map(
            data.map(row => [Number(row.id), row])
        );

        const orderedData = cleanIds
            .map(id => rowMap.get(id))
            .filter(Boolean);

        res.json({
            success: true,
            table: tableName,
            count: orderedData.length,
            data: orderedData
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`CEZOO API running on port ${PORT}`);
});
