const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database", "adega.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_barras TEXT UNIQUE,
    nome TEXT NOT NULL,
    categoria_id INTEGER,
    preco_custo REAL NOT NULL DEFAULT 0,
    preco_venda REAL NOT NULL DEFAULT 0,
    quantidade INTEGER NOT NULL DEFAULT 0,
    estoque_minimo INTEGER NOT NULL DEFAULT 0,
    unidade TEXT NOT NULL DEFAULT 'un',
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE IF NOT EXISTS tipos_venda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS caixas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_abertura DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_fechamento DATETIME,
    valor_inicial REAL NOT NULL DEFAULT 0,
    valor_final_informado REAL,
    valor_esperado REAL,
    diferenca REAL,
    status TEXT NOT NULL DEFAULT 'aberto',
    usuario_abertura_id INTEGER,
    usuario_abertura_nome TEXT,
    usuario_fechamento_id INTEGER,
    usuario_fechamento_nome TEXT,

    FOREIGN KEY (usuario_abertura_id) REFERENCES usuarios(id),
    FOREIGN KEY (usuario_fechamento_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caixa_id INTEGER NOT NULL,
    tipo_venda_id INTEGER NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    desconto REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'finalizada',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (caixa_id) REFERENCES caixas(id),
    FOREIGN KEY (tipo_venda_id) REFERENCES tipos_venda(id)
);

CREATE TABLE IF NOT EXISTS itens_venda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venda_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,

    FOREIGN KEY (venda_id) REFERENCES vendas(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE IF NOT EXISTS pagamentos_venda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venda_id INTEGER NOT NULL,
    forma_pagamento TEXT NOT NULL,
    valor REAL NOT NULL,
    valor_recebido REAL DEFAULT 0,
    troco REAL DEFAULT 0,

    FOREIGN KEY (venda_id) REFERENCES vendas(id)
);

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    motivo TEXT,
    venda_id INTEGER,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (venda_id) REFERENCES vendas(id)
);

CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caixa_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    valor REAL NOT NULL,
    descricao TEXT,
    venda_id INTEGER,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (caixa_id) REFERENCES caixas(id),
    FOREIGN KEY (venda_id) REFERENCES vendas(id)
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    usuario TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'operador',
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    usuario_nome TEXT NOT NULL,
    usuario_login TEXT NOT NULL,
    perfil TEXT NOT NULL,
    acao TEXT NOT NULL,
    entidade TEXT,
    entidade_id INTEGER,
    descricao TEXT NOT NULL,
    detalhes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria(criado_em);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria(acao);


CREATE TABLE IF NOT EXISTS inventarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    usuario_nome TEXT,
    status TEXT NOT NULL DEFAULT 'aberto',
    total_produtos INTEGER NOT NULL DEFAULT 0,
    total_divergencias INTEGER NOT NULL DEFAULT 0,
    ajuste_total INTEGER NOT NULL DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    finalizado_em DATETIME,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS itens_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventario_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    produto_nome TEXT NOT NULL,
    unidade TEXT,
    estoque_sistema INTEGER NOT NULL DEFAULT 0,
    quantidade_contada INTEGER,
    diferenca INTEGER,
    FOREIGN KEY (inventario_id) REFERENCES inventarios(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE INDEX IF NOT EXISTS idx_itens_inventario_inventario
ON itens_inventario(inventario_id);

CREATE TABLE IF NOT EXISTS configuracoes (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome_adega TEXT NOT NULL DEFAULT 'Adega do Chefe',
    subtitulo TEXT NOT NULL DEFAULT 'Sistema de Gestão',
    logo TEXT,
    estoque_minimo_padrao INTEGER NOT NULL DEFAULT 0,
    tema_padrao TEXT NOT NULL DEFAULT 'claro',
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO configuracoes (id) VALUES (1);

`);

// ========================================
// USUÁRIO ADMINISTRADOR INICIAL
// ========================================

const bcrypt = require("bcrypt");

const adminExiste = db.prepare(`
    SELECT id
    FROM usuarios
    WHERE usuario = ?
`).get("admin");

if (!adminExiste) {

    const senhaHash =
        bcrypt.hashSync("admin123", 10);

    db.prepare(`
        INSERT INTO usuarios (
            nome,
            usuario,
            senha_hash,
            perfil,
            ativo
        )
        VALUES (?, ?, ?, ?, 1)
    `).run(
        "Administrador",
        "admin",
        senhaHash,
        "administrador"
    );

    console.log(
        "Usuário administrador inicial criado."
    );
}

// ========================================
// MIGRAÇÕES
// ========================================

// Vincula a abertura e o fechamento do caixa ao usuário logado.

const colunasCaixas = db
    .prepare(`
        PRAGMA table_info(caixas)
    `)
    .all();

const nomesColunasCaixas =
    new Set(
        colunasCaixas.map(
            coluna => coluna.name
        )
    );

const migracoesCaixaUsuario = [
    [
        "usuario_abertura_id",
        "INTEGER"
    ],
    [
        "usuario_abertura_nome",
        "TEXT"
    ],
    [
        "usuario_fechamento_id",
        "INTEGER"
    ],
    [
        "usuario_fechamento_nome",
        "TEXT"
    ]
];

for (const [coluna, tipo] of migracoesCaixaUsuario) {
    if (!nomesColunasCaixas.has(coluna)) {
        db.exec(`
            ALTER TABLE caixas
            ADD COLUMN ${coluna} ${tipo}
        `);

        console.log(
            `Migração concluída: ${coluna} adicionado em caixas.`
        );
    }
}


// Configurações ampliadas da adega e do PDV.
const colunasConfiguracoes = db
    .prepare(`
        PRAGMA table_info(configuracoes)
    `)
    .all();

const nomesColunasConfiguracoes =
    new Set(
        colunasConfiguracoes.map(
            coluna => coluna.name
        )
    );

const migracoesConfiguracoes = [
    ["razao_social", "TEXT"],
    ["cnpj", "TEXT"],
    ["telefone", "TEXT"],
    ["endereco", "TEXT"],
    ["numero", "TEXT"],
    ["complemento", "TEXT"],
    ["bairro", "TEXT"],
    ["cidade", "TEXT"],
    ["estado", "TEXT"],
    ["cep", "TEXT"],
    ["dias_produto_parado", "INTEGER NOT NULL DEFAULT 30"],
    ["pdv_exibir_destaques", "INTEGER NOT NULL DEFAULT 1"],
    ["pdv_quantidade_destaques", "INTEGER NOT NULL DEFAULT 8"],
    ["pdv_foco_busca", "INTEGER NOT NULL DEFAULT 1"],
    ["pdv_permitir_desconto", "INTEGER NOT NULL DEFAULT 1"],
    ["pdv_desconto_maximo_percentual", "REAL NOT NULL DEFAULT 100"]
];

for (const [coluna, definicao] of migracoesConfiguracoes) {
    if (!nomesColunasConfiguracoes.has(coluna)) {
        db.exec(`
            ALTER TABLE configuracoes
            ADD COLUMN ${coluna} ${definicao}
        `);

        console.log(
            `Migração concluída: ${coluna} adicionado em configuracoes.`
        );
    }
}


// ========================================
// PRODUTOS FRACIONADOS
// ========================================

const colunasProdutosFracionados = db
    .prepare(`PRAGMA table_info(produtos)`)
    .all();

const nomesColunasProdutosFracionados =
    new Set(
        colunasProdutosFracionados.map(
            coluna => coluna.name
        )
    );

if (!nomesColunasProdutosFracionados.has("tipo_estoque")) {
    db.exec(`
        ALTER TABLE produtos
        ADD COLUMN tipo_estoque TEXT NOT NULL DEFAULT 'normal'
    `);

    console.log(
        "Migração concluída: tipo_estoque adicionado em produtos."
    );
}

db.exec(`
    CREATE TABLE IF NOT EXISTS produto_fracionado_componentes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_id INTEGER NOT NULL,
        produto_estoque_id INTEGER NOT NULL,
        fator_conversao INTEGER NOT NULL DEFAULT 1,
        fracao_atual INTEGER NOT NULL DEFAULT 0,
        ordem INTEGER NOT NULL DEFAULT 1,

        UNIQUE (produto_id, produto_estoque_id),

        FOREIGN KEY (produto_id)
            REFERENCES produtos(id)
            ON DELETE CASCADE,

        FOREIGN KEY (produto_estoque_id)
            REFERENCES produtos(id)
    )
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_produto_fracionado_produto
    ON produto_fracionado_componentes(produto_id)
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_produto_fracionado_estoque
    ON produto_fracionado_componentes(produto_estoque_id)
`);


// ========================================
// PRODUTOS KIT / COMBO
// ========================================
// Um Kit não possui estoque próprio. Cada venda baixa quantidades exatas
// de produtos físicos vinculados. Ex.: Balde 10 Heineken => baixa 10 latas.

db.exec(`
    CREATE TABLE IF NOT EXISTS produto_kit_componentes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_id INTEGER NOT NULL,
        produto_estoque_id INTEGER NOT NULL,
        quantidade_por_venda INTEGER NOT NULL DEFAULT 1,
        ordem INTEGER NOT NULL DEFAULT 1,

        UNIQUE (produto_id, produto_estoque_id),

        FOREIGN KEY (produto_id)
            REFERENCES produtos(id)
            ON DELETE CASCADE,

        FOREIGN KEY (produto_estoque_id)
            REFERENCES produtos(id)
    )
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_produto_kit_produto
    ON produto_kit_componentes(produto_id)
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_produto_kit_estoque
    ON produto_kit_componentes(produto_estoque_id)
`);


// Validade atual do produto.
const colunasProdutosValidade = db
    .prepare(`PRAGMA table_info(produtos)`)
    .all();

if (!colunasProdutosValidade.some(coluna => coluna.name === "data_validade")) {
    db.exec(`
        ALTER TABLE produtos
        ADD COLUMN data_validade TEXT
    `);

    console.log("Migração concluída: data_validade adicionada em produtos.");
}

// Adiciona custo_unitario em itens_venda
// para preservar o custo histórico da venda.

const colunasItensVenda = db
    .prepare(`
        PRAGMA table_info(itens_venda)
    `)
    .all();

const possuiCustoUnitario =
    colunasItensVenda.some(
        coluna =>
            coluna.name === "custo_unitario"
    );

if (!possuiCustoUnitario) {

    db.exec(`
        ALTER TABLE itens_venda
        ADD COLUMN custo_unitario
        REAL NOT NULL DEFAULT 0
    `);

    console.log(
        "Migração concluída: custo_unitario adicionado em itens_venda."
    );
}



// ========================================
// SEGURANÇA DE LOGIN
// ========================================
// Contador persistente de tentativas e bloqueio temporário.
const colunasUsuarios = db.prepare(`PRAGMA table_info(usuarios)`).all();
const nomesColunasUsuarios = new Set(colunasUsuarios.map(coluna => coluna.name));

if (!nomesColunasUsuarios.has("tentativas_login")) {
    db.exec(`ALTER TABLE usuarios ADD COLUMN tentativas_login INTEGER NOT NULL DEFAULT 0`);
    console.log("Migração concluída: tentativas_login adicionado em usuarios.");
}

if (!nomesColunasUsuarios.has("bloqueado_ate")) {
    db.exec(`ALTER TABLE usuarios ADD COLUMN bloqueado_ate TEXT`);
    console.log("Migração concluída: bloqueado_ate adicionado em usuarios.");
}

const tiposVendaPadrao = [
    "Balcão",
    "Delivery",
    "Retirada",
    "Consumo no local",
    "Encomenda"
];

const inserirTipo = db.prepare(`
    INSERT OR IGNORE INTO tipos_venda (nome)
    VALUES (?)
`);

for (const tipo of tiposVendaPadrao) {
    inserirTipo.run(tipo);
}



// ========================================
// COMANDAS / CONSUMO EM ABERTO
// ========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS comandas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        observacao TEXT,
        status TEXT NOT NULL DEFAULT 'aberta',
        usuario_abertura_id INTEGER,
        usuario_abertura_nome TEXT,
        venda_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        finalizado_em DATETIME,

        FOREIGN KEY (usuario_abertura_id) REFERENCES usuarios(id),
        FOREIGN KEY (venda_id) REFERENCES vendas(id)
    );

    CREATE TABLE IF NOT EXISTS comanda_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comanda_id INTEGER NOT NULL,
        produto_id INTEGER NOT NULL,
        produto_nome TEXT NOT NULL,
        quantidade INTEGER NOT NULL,
        preco_unitario REAL NOT NULL DEFAULT 0,
        custo_unitario REAL NOT NULL DEFAULT 0,
        subtotal REAL NOT NULL DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
    );

    CREATE INDEX IF NOT EXISTS idx_comandas_status
    ON comandas(status);

    CREATE INDEX IF NOT EXISTS idx_comanda_itens_comanda
    ON comanda_itens(comanda_id);

    CREATE INDEX IF NOT EXISTS idx_comandas_status_atualizado
    ON comandas(status, atualizado_em DESC);

    CREATE INDEX IF NOT EXISTS idx_produtos_ativo_nome
    ON produtos(ativo, nome);

    CREATE INDEX IF NOT EXISTS idx_vendas_caixa_status_data
    ON vendas(caixa_id, status, criado_em);

    CREATE INDEX IF NOT EXISTS idx_itens_venda_venda
    ON itens_venda(venda_id);

    CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_venda
    ON pagamentos_venda(venda_id);

    CREATE INDEX IF NOT EXISTS idx_mov_estoque_produto_data
    ON movimentacoes_estoque(produto_id, criado_em);

    CREATE INDEX IF NOT EXISTS idx_mov_caixa_caixa_data
    ON movimentacoes_caixa(caixa_id, criado_em);
`);

module.exports = db;