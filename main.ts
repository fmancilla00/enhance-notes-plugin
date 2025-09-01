import {
	App,
	Menu,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	credentials: {
		username: string;
		password: string;
	};
	notesWebhookUrl: string;
	embeddingsWebhookUrl: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	credentials: {
		username: "",
		password: "",
	},
	notesWebhookUrl: "",
	embeddingsWebhookUrl: "",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		// Registrar la pestaña de settings
		this.addSettingTab(new MyPluginSettingTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
				// Solo queremos archivos markdown
				if (file.extension === "md") {
					menu.addItem((item) => {
						item.setTitle("Generar nota mejorada")
							.setIcon("sparkles") // Puedes elegir otro icono si quieres
							.onClick(async () => {
								await this.sendMdToApi(file);
							});
					});
				}
				if (file.extension === "pdf") {
					menu.addItem((item) => {
						item.setTitle("Vectorizar")
							.setIcon("database-zap")
							.onClick(async () => {
								await this.sendPdfToApi(file);
							});
					});
				}
			})
		);
	}

	async sendMdToApi(file: TFile) {
		// Obtiene el contenido del archivo
		const fileContent = await this.app.vault.read(file);

		// Obtiene el path completo y el directorio
		const filePath = file.path;
		let dirPath = filePath.substring(0, filePath.lastIndexOf("/"));

		// Cortamos el primer path, ya que siempre sera el nombre del repo
		dirPath = dirPath.substring(dirPath.indexOf("/") + 1);

		// Construye el payload
		const payload = {
			fileName: file.name,
			filePath: filePath,
			dirPath: dirPath,
			content: fileContent,
			title: file.basename,
		};

		// Envía la información a la API
		try {
			const response = await fetch(this.settings.notesWebhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					// agregamos basic auth
					Authorization:
						"Basic " +
						btoa(
							this.settings.credentials.username +
								":" +
								this.settings.credentials.password
						),
				},
				body: JSON.stringify(payload),
			});

			if (response.ok) {
				new Notice("Archivo enviado correctamente.");
			} else {
				new Notice("Error al enviar el archivo.");
			}
		} catch (error) {
			new Notice("Error de red al enviar el archivo.");
			console.error(error);
		}
	}

	async sendPdfToApi(file: TFile) {
		try {
			// Lee el archivo como binario
			const arrayBuffer = await this.app.vault.readBinary(file);

			// Crea un blob y un FormData
			const blob = new Blob([arrayBuffer], { type: "application/pdf" });
			const formData = new FormData();
			formData.append("file", blob, file.name);

			// Envía el archivo al webhook de n8n con auth
			const response = await fetch(this.settings.embeddingsWebhookUrl, {
				method: "POST",
				headers: {
					Authorization:
						"Basic " +
						btoa(
							this.settings.credentials.username +
								":" +
								this.settings.credentials.password
						),
				},
				body: formData,
			});

			if (response.ok) {
				new Notice("PDF enviado a n8n correctamente.");
			} else {
				new Notice("Error al enviar el PDF a n8n.");
			}
		} catch (error) {
			new Notice("Error de red al enviar el PDF a n8n.");
			console.error(error);
		}
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Configuración de credenciales" });

		new Setting(containerEl)
			.setName("Usuario")
			.setDesc("Usuario para autenticación")
			.addText((text) =>
				text
					.setPlaceholder("usuario")
					.setValue(this.plugin.settings.credentials.username)
					.onChange(async (value) => {
						this.plugin.settings.credentials.username = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Contraseña")
			.setDesc("Contraseña para autenticación")
			.addText(
				(text) =>
					text
						.setPlaceholder("contraseña")
						.setValue(this.plugin.settings.credentials.password)
						.onChange(async (value) => {
							this.plugin.settings.credentials.password = value;
							await this.plugin.saveSettings();
						})
						.inputEl.setAttribute("type", "password") // Oculta el texto
			);

		new Setting(containerEl)
			.setName("URL de la API")
			.setDesc("URL de la API")
			.addText((text) =>
				text
					.setPlaceholder("url")
					.setValue(this.plugin.settings.notesWebhookUrl)
					.onChange(async (value) => {
						this.plugin.settings.notesWebhookUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("URL de la API de embeddings")
			.setDesc("URL de la API de embeddings")
			.addText((text) =>
				text
					.setPlaceholder("url")
					.setValue(this.plugin.settings.embeddingsWebhookUrl)
					.onChange(async (value) => {
						this.plugin.settings.embeddingsWebhookUrl = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
