"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clients = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const fs_1 = __importDefault(require("fs"));
const uid_1 = require("uid");
const app = (0, express_1.default)();
const storage = multer_1.default.diskStorage({
    destination: "uploads/",
    filename: (req, file, callback) => {
        const ext = path_1.default.extname(file.originalname);
        callback(null, `${path_1.default.basename(file.originalname, ext)}-${Date.now()}${ext}`);
    },
});
const upload = (0, multer_1.default)({ storage });
const port = process.env.port || 3000;
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
exports.clients = {};
app.get("/", (req, res) => {
    res.send("Servidor TypeScript no ar! 🚀");
});
app.get("/events", (req, res) => {
    const jobID = req.query.jobID;
    // Configurando SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    exports.clients[jobID] = res;
    req.on("close", () => {
        delete exports.clients[jobID];
    });
});
async function fileProcessor(filePath, jobID, fileSize) {
    while (!exports.clients[jobID]) {
        await new Promise((r) => setTimeout(r, 50));
    }
    const client = exports.clients[jobID];
    if (!client || !filePath || !fileSize)
        return client.status(505).json({ message: "error" });
    // Convertendo arquivo e enviando para o frontend
    const readStrem = fs_1.default.createReadStream(filePath);
    let buffer = [];
    let processedBytes = 0;
    readStrem.on("data", (chunk) => {
        processedBytes += chunk.length;
        const progress = (processedBytes / fileSize) * 100;
        client.write(`event: progress\ndata: ${progress.toFixed(0)}\n\n`);
    });
    readStrem
        .pipe((0, csv_parser_1.default)())
        .on("data", (row) => {
        buffer.push(row);
        if (buffer.length >= 5000) {
            client.write(`event: getting\ndata: ${JSON.stringify(buffer)}\n\n`);
            buffer = [];
        }
    })
        .on("end", () => {
        if (buffer.length > 0) {
            client.write(`event: getting\ndata: ${JSON.stringify(buffer)}\n\n`);
        }
        client.write(`event: done\ndata: ${Date.now()}\n\n`);
        client.end();
        fs_1.default.unlinkSync(filePath); // Remover arquivo após leitura
    })
        .on("error", (err) => {
        client.write(`event: error\ndata: ${err.message}\n\n`);
        client.end();
    });
}
// Rota que recebe arquivo
app.post("/upload", upload.single("file"), async (req, res) => {
    const filePath = req.file?.path;
    const jobID = (0, uid_1.uid)();
    if (!jobID)
        return res.json({
            message: "Error ao criar ID de processamente",
            status: "error",
        });
    if (!filePath)
        return res.json({
            message: "Error ao obter caminho no arquivo",
            status: "error",
        });
    const ext = path_1.default.extname(filePath);
    if (ext !== '.csv')
        return res.status(400).json({
            message: "Formato inválido. Envie apenas arquivos CSV.",
            status: "error",
        });
    res.json({
        message: "Processamento iniciado",
        status: "processing",
        jobID,
    });
    process.nextTick(() => fileProcessor(filePath, jobID, req.file?.size));
});
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map