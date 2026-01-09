import joplin from 'api';
import * as path from 'path';
import { SettingItemType, ToolbarButtonLocation } from 'api/types';

const sqlite3 = joplin.require('sqlite3');
const fs = joplin.require('fs-extra');

let isPanelVisible = false; // 初始状态为隐藏

joplin.plugins.register({

	onStart: async function () {

		const panel = await joplin.views.panels.create('pannel_1');

		//  初始化时先隐藏面板
		await joplin.views.panels.hide(panel);

		// 注册一个命令（Command）用于切换显示
		await joplin.commands.register({
			name: 'toggleTermPanel',
			label: '打开/关闭术语表',
			iconName: 'fas fa-book', // 使用 FontAwesome 图标
			execute: async () => {
				isPanelVisible = !isPanelVisible;
				if (isPanelVisible) {
					await joplin.views.panels.show(panel);
				} else {
					await joplin.views.panels.hide(panel);
				}
			},
		});

		// 将这个命令添加到编辑器的工具栏
		await joplin.views.toolbarButtons.create(
			'toggleTermBtn',
			'toggleTermPanel',
			ToolbarButtonLocation.NoteToolbar
		);

		// --- 1. 注册设置项 ---
		await joplin.settings.registerSection('termSettings', {
			label: '术语库设置',
			iconName: 'fas fa-database',
		});

		await joplin.settings.registerSettings({
			'customDbPath': {
				value: '', // 默认为空，表示使用预设路径
				type: SettingItemType.String,
				section: 'termSettings',
				public: true,
				label: '自定义数据库路径',
				description: '留空则使用默认路径（插件目录/database/terms.db）。修改后需重启 Joplin。',
			},
		});

		// --- 2. 路径逻辑计算 ---
		const userPath = await joplin.settings.value('customDbPath');
		let finalPath: string;

		if (userPath && userPath.trim() !== '') {
			finalPath = userPath;
		} else {
			// 预设路径逻辑
			const dataDir = await joplin.plugins.dataDir();
			const defaultDbDir = path.join(dataDir, 'database');

			// 重要：确保 database 文件夹存在
			if (!(await fs.pathExists(defaultDbDir))) {
				await fs.mkdirp(defaultDbDir);
			}
			finalPath = path.join(defaultDbDir, 'terms.db');
		}

		// 3. 开启数据库连接
		// sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE 允许读写和自动创建
		const db = new sqlite3.Database(finalPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
			if (err) console.error('数据库连接失败:', err.message);
			else console.log('已成功连接到外部 SQLite 数据库:', finalPath);
		});

		// 连接成功后，立即初始化表结构
		try {
			await initTableStructure(db);
			console.log('表结构检查/初始化完成');
		} catch (tableErr) {
			console.error('表结构初始化失败:', tableErr);
		}

		// 初始化表的函数
		async function initTableStructure(db) {
			return new Promise((resolve, reject) => {
				// 使用 CREATE TABLE IF NOT EXISTS 防止重复创建报错
				const sql = `
            CREATE TABLE IF NOT EXISTS terms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                termAbbr TEXT NOT NULL,
                termFull TEXT,
                termCategory TEXT,
                termDefinition TEXT,
                createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
                -- 核心：建立你之前遇到的唯一约束
                UNIQUE(termAbbr, termCategory)
            );
        `;

				db.run(sql, (err) => {
					if (err) reject(err);
					else resolve(true);
				});
			});
		}


		// 封装 db.all (查询多行)
		const dbAll = (sql: string, params: any[] = []) => {
			return new Promise((resolve, reject) => {
				db.all(sql, params, (err, rows) => {
					if (err) reject(err);
					else resolve(rows);
				});
			});
		};

		// 封装 db.run (增、删、改)
		const dbRun = (sql: string, params: any[] = []) => {
			return new Promise((resolve, reject) => {
				db.run(sql, params, function (err) {
					if (err) reject(err);
					else resolve({ id: this.lastID, changes: this.changes, success: true });
				});
			});
		};

		await joplin.views.panels.onMessage(panel, async (message) => {
			try {
				const data = message.data;
				switch (message.type) {
					case 'ping':
						return 'pong';

					case 'get_all':
						return await dbAll("SELECT * FROM terms");

					case 'search':
						console.log('Searching for:', message.query);
						return await dbAll("SELECT * FROM terms WHERE termAbbr LIKE ?", [`%${message.query}%`]);

					case 'add':
						console.log('Adding term:', data);
						return await dbRun("INSERT INTO terms (termAbbr, termFull, termDefinition, termCategory) VALUES (?,?,?,?)", [data.termAbbr, data.termFull, data.termDefinition, data.termCategory]);

					case 'update':
						console.log('Updating term:', data);
						return await dbRun("UPDATE terms SET termAbbr = ?, termFull = ?, termDefinition = ?, termCategory = ? WHERE id = ?", [data.termAbbr, data.termFull, data.termDefinition, data.termCategory, data.id]);

					case 'delete':
						return await dbRun("DELETE FROM terms WHERE id = ?", [message.id]);

					default:
						return { error: "Unknown command" };
				}
			} catch (error) {
				console.error("SQL Error:", error);
				return { error: error.message };
			}
		});

		const installDir = await joplin.plugins.installationDir();

		//获取html内容
		const uiContent = await fs.readFile(`${installDir}/UI/main.html`, 'utf8');

		//设置panel的html内容
		await joplin.views.panels.setHtml(panel, uiContent);

		await joplin.views.panels.addScript(panel, `./UI/Term.js`);

		await joplin.views.panels.addScript(panel, `./UI/main.css`);

		async function updateTocView() {
		}

		//This event will be triggered when the user selects a different note
		await joplin.workspace.onNoteSelectionChange(
			() => {
				updateTocView();
			}
		);

		//This event will be triggered when the content of the note changes
		//as u also want to update the TOC in this case
		await joplin.workspace.onNoteChange(
			() => {
				updateTocView();
			}
		);


		// Also update the TOC when the plugin starts
		updateTocView();
	},
});
