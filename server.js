"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
// Models & DB
const index_1 = require("./src/models/index");
// Routes
const userRoutes_1 = __importDefault(require("./src/routes/userRoutes"));
const authRoutes_1 = __importDefault(require("./src/routes/authRoutes"));
const productRoutes_1 = __importDefault(require("./src/routes/productRoutes"));
const categoryRoutes_1 = __importDefault(require("./src/routes/categoryRoutes"));
// Middleware
const errorHandler_1 = require("./src/middleware/errorHandler");
const logger_1 = __importDefault(require("./src/config/logger"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// ✅ Proper CORS setup
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = ['http://localhost:5173', 'https://fastshopping.rw'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// ✅ Add a quick sanity check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
// ✅ Register routes
app.use('/api/users', userRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/products', productRoutes_1.default);
app.use('/api/categories', categoryRoutes_1.default);
// ✅ Global error handling
app.use(errorHandler_1.errorHandler);
// ✅ Safe boot sequence
const startServer = async () => {
    try {
        await index_1.sequelize.authenticate();
        logger_1.default.info('Database connection established successfully');
        if (process.env.NODE_ENV !== 'production') {
            await index_1.sequelize.sync({ alter: true });
            logger_1.default.info('Database synchronized');
        }
        app.listen(PORT, () => {
            logger_1.default.info(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        logger_1.default.error('Unable to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=server.js.map