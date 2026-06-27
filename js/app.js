(function () {
  const DEFAULT_FILE_NAME_TEMPLATE = '{姓名}_{手机号}_{附件编号}_{资料名称}_{序号}.{扩展名}';
  const LEGACY_FILE_NAME_TEMPLATES = new Set([
    '{姓名}_中粮贸易新员工信息登记表.{扩展名}',
    '{姓名}_招聘人员近亲属系统内从业情况.{扩展名}',
    '{姓名}_粮达网新员工信息登记表.{扩展名}',
    '{姓名}_{手机号}_其他材料_{序号}.{扩展名}'
  ]);
  const { createApp } = Vue;
  const { ElMessage, ElMessageBox } = ElementPlus;
  const FORMAT_GROUPS = [
    { label: '图片', value: 'image', extensions: ['jpg', 'jpeg', 'png'] },
    { label: 'PDF', value: 'pdf', extensions: ['pdf'] },
    { label: 'Word 文档', value: 'word', extensions: ['doc', 'docx'] },
    { label: 'Excel 表格', value: 'excel', extensions: ['xls', 'xlsx'] },
    { label: '压缩包', value: 'archive', extensions: ['zip', 'rar', '7z'] }
  ];

  function groupsToExtensions(groups) {
    return [...new Set((groups || []).flatMap((group) => (
      FORMAT_GROUPS.find((item) => item.value === group)?.extensions || []
    )))];
  }

  function extensionsToGroups(extensions) {
    const set = new Set(extensions || []);
    return FORMAT_GROUPS
      .filter((group) => group.extensions.some((ext) => set.has(ext)))
      .map((group) => group.value);
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeConfig(config) {
    const cloned = deepClone(config || window.DEFAULT_APP_CONFIG);
    const defaults = window.DEFAULT_APP_CONFIG || {};
    cloned.form = { ...(defaults.form || {}), ...(cloned.form || {}) };
    cloned.limits = { ...(defaults.limits || {}), ...(cloned.limits || {}) };
    cloned.naming = { ...(defaults.naming || {}), ...(cloned.naming || {}) };
    cloned.email = { ...(defaults.email || {}), ...(cloned.email || {}) };
    const useLegacyDefaultCodes = (cloned.attachments || []).some((item) => (
      item.id === 'attachment_04_id_card' && item.code === '附件04'
    ));
    cloned.baseFields = (cloned.baseFields || []).map((field, index) => ({
      sort: field.sort || index + 1,
      key: field.key || `field_${index + 1}`,
      label: field.label || `字段${index + 1}`,
      type: field.type || 'text',
      required: Boolean(field.required),
      placeholder: field.placeholder || ''
    }));
    cloned.attachments = [...(cloned.attachments || [])]
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
      .map((item, index) => {
      const extensions = Array.isArray(item.allowedExtensions)
        ? item.allowedExtensions
        : String(item.allowedExtensions || item.allowedExtensionsText || '')
          .split(',')
          .map((ext) => ext.trim().toLowerCase())
          .filter(Boolean);
      return {
        sort: index + 1,
        id: item.id || `attachment_${Date.now()}_${index}`,
        code: useLegacyDefaultCodes && /^附件\d+$/.test(item.code || '')
          ? `附件${String(index + 1).padStart(2, '0')}`
          : (item.code || `附件${String(index + 1).padStart(2, '0')}`),
        name: item.name || `资料项${index + 1}`,
        required: Boolean(item.required),
        isTemplate: Boolean(item.isTemplate),
        allowedExtensions: extensions,
        allowedExtensionsText: extensions.join(','),
        allowedFormatGroups: Array.isArray(item.allowedFormatGroups)
          ? item.allowedFormatGroups
          : extensionsToGroups(extensions),
        maxFiles: Number(item.maxFiles || cloned.limits?.defaultMaxFiles || 10),
        maxSizeMB: Number(item.maxSizeMB || cloned.limits?.defaultMaxSizeMB || 20),
        templateUrl: item.templateUrl || '',
        exampleImageUrl: item.exampleImageUrl || item.exampleUrl || '',
        fileNameTemplate: !item.fileNameTemplate || LEGACY_FILE_NAME_TEMPLATES.has(item.fileNameTemplate)
          ? DEFAULT_FILE_NAME_TEMPLATE
          : item.fileNameTemplate,
        description: item.description || ''
      };
    });
    return cloned;
  }

  function loadInitialConfig() {
    return normalizeConfig(window.DEFAULT_APP_CONFIG);
  }

  function parseConfigJs(text) {
    const configWindow = {};
    const script = new Function('window', `${text}\n;return window.DEFAULT_APP_CONFIG;`);
    return script(configWindow);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function getDateParts() {
    const now = new Date();
    return {
      date: `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`,
      dateText: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
      time: `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`,
      timeText: `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`,
      dateTimeText: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
    };
  }

  createApp({
    data() {
      const config = loadInitialConfig();
      const formData = {};
      config.baseFields.forEach((field) => {
        formData[field.key] = '';
      });
      return {
        guideAccepted: false,
        currentStep: 0,
        currentView: 'collect',
        viewOptions: [
          { label: '资料填写', value: 'collect' },
          { label: '配置管理', value: 'config' }
        ],
        config,
        formData,
        uploadFiles: {},
        zipPassword: '',
        generating: false,
        generatedZipBlob: null,
        generatedZipName: '',
        generatedEmailSubject: '',
        generatedEmailBody: '',
        resultDialogVisible: false,
        exampleDialogVisible: false,
        currentExampleTitle: '',
        currentExampleImageUrl: '',
        currentExampleDescription: '',
        configTab: 'base',
        collapsedAttachmentMap: {},
        uploadFormatOptions: FORMAT_GROUPS
      };
    },
    computed: {
      sortedBaseFields() {
        return [...(this.config.baseFields || [])].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
      },
      sortedAttachments() {
        return [...(this.config.attachments || [])].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
      },
      completionStats() {
        const requiredFields = this.sortedBaseFields.filter((field) => field.required);
        const requiredAttachments = this.sortedAttachments.filter((item) => item.required);
        const filledFields = requiredFields.filter((field) => String(this.formData[field.key] || '').trim()).length;
        const uploadedAttachments = requiredAttachments.filter((item) => (this.uploadFiles[item.id] || []).length > 0).length;
        const total = requiredFields.length + requiredAttachments.length;
        const completed = filledFields + uploadedAttachments;
        return {
          total,
          completed,
          uploaded: this.sortedAttachments.filter((item) => (this.uploadFiles[item.id] || []).length > 0).length,
          percentage: total ? Math.round((completed / total) * 100) : 100
        };
      },
      archiveFileList() {
        const rootFolder = (this.generatedZipName || '入职资料包.zip').replace(/\.zip$/i, '');
        const files = [`${rootFolder}/01_基础信息.txt`];
        this.sortedAttachments.forEach((item) => {
          const folder = `${rootFolder}/${this.buildFolderName(item)}`;
          (this.uploadFiles[item.id] || []).forEach((file, index) => {
            files.push(`${folder}/${this.buildFileName(item, file, index)}`);
          });
        });
        return files;
      },
      
    },
    watch: {
      'config.baseFields': {
        deep: true,
        handler(fields) {
          fields.forEach((field) => {
            if (field.key && this.formData[field.key] === undefined) {
              this.formData[field.key] = '';
            }
          });
        }
      }
    },
    mounted() {
      if (document.body.dataset.page !== 'collect') return;
      fetch('./js/config.js', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('未找到已发布配置');
          return response.text();
        })
        .then((text) => {
          const config = parseConfigJs(text);
          this.config = normalizeConfig(config);
          this.formData = {};
          this.config.baseFields.forEach((field) => {
            this.formData[field.key] = '';
          });
        })
        .catch(() => {
          // 无法重新读取 js/config.js 时继续使用页面已加载的内置默认配置，便于本地预览。
        });
    },
    methods: {
      formatDescription(text) {
        return String(text || '').replace(/\n/g, '<br />');
      },
      resolveAssetPath(value, baseDir) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const normalized = raw.replace(/\\/g, '/');
        if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
        if (normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) return normalized;
        if (normalized.includes('/')) return normalized;
        return `${baseDir}/${normalized}`;
      },
      resolveTemplateUrl(item) {
        return this.resolveAssetPath(item?.templateUrl, 'templates');
      },
      resolveExampleImageUrl(item) {
        return this.resolveAssetPath(item?.exampleImageUrl || item?.exampleUrl, 'examples');
      },
      openExample(item) {
        this.currentExampleTitle = `${item.code || ''}：${item.name || ''} 示例`;
        this.currentExampleImageUrl = this.resolveExampleImageUrl(item);
        this.currentExampleDescription = item?.description || '';
        this.exampleDialogVisible = true;
      },
      openTemplate(item) {
        const url = this.resolveTemplateUrl(item);
        if (!url) {
          ElMessage.warning('请先填写模板文件名称。');
          return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
      },
      previewUploaded(item, fileIndex = 0) {
        const files = this.uploadFiles[item.id] || [];
        if (!files.length) {
          ElMessage.warning('请先上传文件后再预览。');
          return;
        }
        const uploadFile = files[fileIndex] || files[0];
        const raw = uploadFile.raw || uploadFile;
        const fileName = raw.name || uploadFile.name || '';
        const url = URL.createObjectURL(raw);
        const ext = this.getFileExtension(fileName);
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
          this.currentExampleTitle = `${item.name}：${fileName}`;
          this.currentExampleImageUrl = url;
          this.currentExampleDescription = files.length > 1 ? `当前预览第 ${fileIndex + 1} 个文件，共 ${files.length} 个文件。` : '';
          this.exampleDialogVisible = true;
          return;
        }
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
      },
      removeUploadedFile(item, fileIndex) {
        const files = [...(this.uploadFiles[item.id] || [])];
        if (fileIndex < 0 || fileIndex >= files.length) return;
        const removed = files.splice(fileIndex, 1)[0];
        this.uploadFiles[item.id] = files;
        ElMessage.success(`已删除 ${removed.name || '文件'}`);
      },
      startCollection() {
        this.guideAccepted = true;
        this.currentStep = 0;
      },
      goPrevious() {
        if (this.currentStep > 0) this.currentStep -= 1;
      },
      goNext() {
        if (this.currentStep === 1) {
          const errors = this.validateAll();
          if (errors.length) {
            this.showValidationErrors(errors);
            return;
          }
        }
        if (this.currentStep === 2 && !this.generatedZipBlob) {
          ElMessage.warning('请先生成并下载加密资料包。');
          return;
        }
        if (this.currentStep < 3) this.currentStep += 1;
      },
      finishCollection() {
        this.resultDialogVisible = true;
      },
      async clearCollection() {
        try {
          await ElMessageBox.confirm('将清空已填写的信息、已选择的文件和 ZIP 密码。此操作无法恢复，是否继续？', '清空本次填写', {
            type: 'warning',
            confirmButtonText: '确认清空',
            cancelButtonText: '取消'
          });
          this.sortedBaseFields.forEach((field) => {
            this.formData[field.key] = '';
          });
          this.uploadFiles = {};
          this.zipPassword = '';
          this.generatedZipBlob = null;
          this.generatedZipName = '';
          this.generatedEmailSubject = '';
          this.generatedEmailBody = '';
          this.resultDialogVisible = false;
          this.currentStep = 0;
          this.guideAccepted = false;
          ElMessage.success('已清空本次填写内容。');
        } catch (error) {
          // 用户取消，无需处理
        }
      },
      normalizeExtensions(value) {
        if (Array.isArray(value)) {
          return value.map((ext) => String(ext).trim().toLowerCase()).filter(Boolean);
        }
        return String(value || '')
          .split(',')
          .map((ext) => ext.trim().replace(/^\./, '').toLowerCase())
          .filter(Boolean);
      },
      syncAttachmentExtensions(item) {
        item.allowedExtensions = this.normalizeExtensions(item.allowedExtensionsText);
        item.allowedExtensionsText = item.allowedExtensions.join(',');
      },
      syncAttachmentFormatGroups(item) {
        item.allowedExtensions = groupsToExtensions(item.allowedFormatGroups);
        item.allowedExtensionsText = item.allowedExtensions.join(',');
      },
      formatExtensions(item) {
        const extensions = this.normalizeExtensions(item.allowedExtensions || item.allowedExtensionsText);
        return extensions.length ? extensions.map((ext) => `.${ext}`).join('、') : '不限';
      },
      buildAccept(item) {
        const extensions = this.normalizeExtensions(item.allowedExtensions || item.allowedExtensionsText);
        return extensions.map((ext) => `.${ext}`).join(',');
      },
      getMaxFiles(item) {
        return Number(item.maxFiles || this.config.limits.defaultMaxFiles || 10);
      },
      getMaxSizeMB(item) {
        return Number(item.maxSizeMB || this.config.limits.defaultMaxSizeMB || 20);
      },
      getFileExtension(fileName) {
        const parts = String(fileName || '').split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
      },
      validateFileForItem(item, uploadFile) {
        const raw = uploadFile.raw || uploadFile;
        const fileName = raw.name || uploadFile.name || '';
        const ext = this.getFileExtension(fileName);
        const allowed = this.normalizeExtensions(item.allowedExtensions || item.allowedExtensionsText);
        if (allowed.length && !allowed.includes(ext)) {
          return `${item.code}：${item.name} 不支持 .${ext || '未知'} 格式，仅支持 ${allowed.map((x) => `.${x}`).join('、')}`;
        }
        const maxSizeBytes = this.getMaxSizeMB(item) * 1024 * 1024;
        if (raw.size > maxSizeBytes) {
          return `${item.code}：${item.name} 中的文件 ${fileName} 超过 ${this.getMaxSizeMB(item)}MB`;
        }
        return '';
      },
      handleAttachmentChange(item, uploadFile, fileList) {
        const maxFiles = this.getMaxFiles(item);
        let nextList = fileList.slice(0, maxFiles);
        if (fileList.length > maxFiles) {
          ElMessage.warning(`${item.code}：${item.name} 最多只能上传 ${maxFiles} 个文件`);
        }
        const validList = [];
        for (const file of nextList) {
          const error = this.validateFileForItem(item, file);
          if (error) {
            ElMessage.error(error);
          } else {
            validList.push(file);
          }
        }
        this.uploadFiles[item.id] = validList;
      },
      handleAttachmentRemove(item, file, fileList) {
        this.uploadFiles[item.id] = fileList || [];
      },
      handleExceed(item) {
        ElMessage.warning(`${item.code}：${item.name} 最多只能上传 ${this.getMaxFiles(item)} 个文件`);
      },
      validateOnly() {
        const errors = this.validateAll();
        if (errors.length) {
          this.showValidationErrors(errors);
          return false;
        }
        ElMessage.success('资料检查通过，可以生成加密资料包。');
        return true;
      },
      validateAll() {
        const errors = [];
        const fields = [...(this.config.baseFields || [])].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
        fields.forEach((field) => {
          const value = String(this.formData[field.key] || '').trim();
          if (field.required && !value) {
            errors.push(`请填写：${field.label}`);
          }
          if (field.type === 'phone' && value && !/^1\d{10}$/.test(value)) {
            errors.push(`${field.label} 格式不正确，请填写 11 位手机号`);
          }
          if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field.label} 格式不正确`);
          }
        });

        let totalSize = 0;
        this.sortedAttachments.forEach((item) => {
          const files = this.uploadFiles[item.id] || [];
          if (item.required && files.length === 0) {
            errors.push(`请上传：${item.code}：${item.name}`);
          }
          if (files.length > this.getMaxFiles(item)) {
            errors.push(`${item.code}：${item.name} 最多只能上传 ${this.getMaxFiles(item)} 个文件`);
          }
          files.forEach((file) => {
            const raw = file.raw || file;
            totalSize += raw.size || 0;
            const error = this.validateFileForItem(item, file);
            if (error) errors.push(error);
          });
        });

        const maxTotalBytes = Number(this.config.limits.maxTotalSizeMB || 200) * 1024 * 1024;
        if (totalSize > maxTotalBytes) {
          errors.push(`所有附件总大小超过 ${this.config.limits.maxTotalSizeMB}MB，请压缩或减少文件后重试`);
        }
        return errors;
      },
      showValidationErrors(errors) {
        const html = `<div class="validation-errors">${errors.map((item, index) => `<p>${index + 1}. ${item}</p>`).join('')}</div>`;
        ElMessageBox.alert(html, '资料检查未通过', {
          dangerouslyUseHTMLString: true,
          confirmButtonText: '我知道了',
          type: 'warning'
        });
      },
      sanitizeSegment(value) {
        return String(value || '')
          .trim()
          .replace(/[\\/:*?"<>|]/g, '_')
          .replace(/\s+/g, '')
          .replace(/_+/g, '_') || '未命名';
      },
      applyTemplate(template, extraVars = {}) {
        const parts = getDateParts();
        const variables = {
          ...this.formData,
          日期: parts.date,
          日期文本: parts.dateText,
          时间: parts.time,
          时间文本: parts.timeText,
          生成时间: parts.dateTimeText,
          表单标题: this.config.form.title || '',
          压缩包名称: this.generatedZipName || '',
          ...extraVars
        };
        return String(template || '').replace(/\{([^{}]+)\}/g, (_, key) => {
          return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : '';
        });
      },
      buildZipName() {
        const name = this.applyTemplate(this.config.naming.zipNameTemplate || '{姓名}_{手机号}_入职资料包_{日期}.zip');
        const sanitized = this.sanitizeSegment(name);
        return sanitized.endsWith('.zip') ? sanitized : `${sanitized}.zip`;
      },
      buildFileName(item, file, index) {
        const raw = file.raw || file;
        const ext = this.getFileExtension(raw.name || file.name || '');
        const seq = String(index + 1).padStart(2, '0');
        const template = item.fileNameTemplate || this.config.naming.fileNameTemplate || DEFAULT_FILE_NAME_TEMPLATE;
        const name = this.applyTemplate(template, {
          附件编号: item.code,
          资料名称: item.name,
          序号: seq,
          扩展名: ext
        });
        return this.sanitizeSegment(name);
      },
      buildFolderName(item) {
        return this.sanitizeSegment(`${item.code}_${item.name}`);
      },
      buildBaseInfoText() {
        const parts = getDateParts();
        const lines = [];
        lines.push(`表单标题：${this.config.form.title || ''}`);
        lines.push(`生成时间：${parts.dateTimeText}`);
        lines.push('');
        lines.push('基础信息：');
        const fields = [...(this.config.baseFields || [])].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
        fields.forEach((field) => {
          lines.push(`${field.label}：${this.formData[field.key] || ''}`);
        });
        lines.push('');
        lines.push('资料清单：');
        this.sortedAttachments.forEach((item) => {
          const files = this.uploadFiles[item.id] || [];
          lines.push(`${item.code}：${item.name}｜${files.length} 个文件`);
        });
        return lines.join('\n');
      },
      async generateZip() {
        const errors = this.validateAll();
        if (errors.length) {
          this.showValidationErrors(errors);
          return;
        }
        if (!this.zipPassword) {
          ElMessage.warning('请输入 ZIP 解压密码后再生成资料包。');
          return;
        }
        if (!window.zip || !zip.ZipWriter) {
          ElMessageBox.alert('ZIP 加密库未加载成功，请检查网络后刷新页面重试。', '无法生成 ZIP', { type: 'error' });
          return;
        }

        this.generating = true;
        this.generatedZipBlob = null;
        this.generatedZipName = this.buildZipName();
        try {
          if (zip.configure) {
            zip.configure({ useWebWorkers: false });
          }
          const zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'), {
            password: this.zipPassword,
            encryptionStrength: 3
          });
          const rootFolder = this.generatedZipName.replace(/\.zip$/i, '');
          const passwordOptions = {
            password: this.zipPassword,
            encryptionStrength: 3
          };

          await zipWriter.add(`${rootFolder}/01_基础信息.txt`, new zip.TextReader(this.buildBaseInfoText()), passwordOptions);

          for (const item of this.sortedAttachments) {
            const files = this.uploadFiles[item.id] || [];
            const folder = `${rootFolder}/${this.buildFolderName(item)}`;
            for (let index = 0; index < files.length; index += 1) {
              const uploadFile = files[index];
              const raw = uploadFile.raw || uploadFile;
              const renamed = this.buildFileName(item, uploadFile, index);
              await zipWriter.add(`${folder}/${renamed}`, new zip.BlobReader(raw), passwordOptions);
            }
          }

          this.generatedZipBlob = await zipWriter.close();
          this.generatedEmailSubject = this.applyTemplate(this.config.email.subjectTemplate || '【入职资料】{姓名}-{手机号}', {
            压缩包名称: this.generatedZipName
          });
          this.generatedEmailBody = this.applyTemplate(this.config.email.bodyTemplate || '', {
            压缩包名称: this.generatedZipName
          });
          this.downloadGeneratedZip();
          ElMessage.success('加密 ZIP 生成成功。');
        } catch (error) {
          console.error(error);
          ElMessageBox.alert(`生成 ZIP 失败：${error.message || error}`, '处理失败', { type: 'error' });
        } finally {
          this.generating = false;
        }
      },
      downloadGeneratedZip() {
        if (!this.generatedZipBlob) {
          ElMessage.warning('请先生成资料包。');
          return;
        }
        const url = URL.createObjectURL(this.generatedZipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.generatedZipName || '入职资料包.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      async copyText(text) {
        if (!text) {
          ElMessage.warning('暂无可复制内容。');
          return;
        }
        try {
          await navigator.clipboard.writeText(text);
          ElMessage.success('已复制。');
        } catch (error) {
          ElMessage.warning('复制失败，请手动选择内容复制。');
        }
      },
      openMailClient() {
        const to = this.config.email.to || '';
        const cc = this.config.email.cc || '';
        const subject = encodeURIComponent(this.generatedEmailSubject || '');
        const body = encodeURIComponent(this.generatedEmailBody || '');
        const ccPart = cc ? `&cc=${encodeURIComponent(cc)}` : '';
        window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}${ccPart}&body=${body}`;
      },
      prepareConfigForSave() {
        const config = deepClone(this.config);
        config.limits = config.limits || {};
        config.limits.defaultMaxSizeMB = Number(config.limits.defaultMaxSizeMB || 20);
        config.limits.defaultMaxFiles = Number(config.limits.defaultMaxFiles || 10);
        config.limits.maxTotalSizeMB = Number(config.limits.maxTotalSizeMB || 200);
        config.naming = config.naming || {};
        config.naming.zipNameTemplate = config.naming.zipNameTemplate || '{姓名}_{手机号}_入职资料包_{日期}.zip';
        config.naming.fileNameTemplate = config.naming.fileNameTemplate || DEFAULT_FILE_NAME_TEMPLATE;
        config.attachments = (config.attachments || [])
          .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
          .map((item, index) => {
          const next = { ...item };
          next.code = `附件${String(index + 1).padStart(2, '0')}`;
          next.sort = index + 1;
          next.templateUrl = String(next.templateUrl || '').trim();
          next.exampleImageUrl = String(next.exampleImageUrl || '').trim();
          next.fileNameTemplate = String(next.fileNameTemplate || DEFAULT_FILE_NAME_TEMPLATE).trim();
          next.isTemplate = Boolean(next.templateUrl);
          next.allowedExtensions = groupsToExtensions(item.allowedFormatGroups);
          next.allowedExtensionsText = next.allowedExtensions.join(',');
          next.allowedFormatGroups = item.allowedFormatGroups || extensionsToGroups(next.allowedExtensions);
          return next;
        });
        return config;
      },
      exportConfig() {
        const content = `window.DEFAULT_APP_CONFIG = ${JSON.stringify(this.prepareConfigForSave(), null, 2)};\n`;
        const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'config.js';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      async resetConfig() {
        try {
          await ElMessageBox.confirm('确定恢复默认配置吗？当前页面修改会被覆盖。', '恢复默认配置', {
            type: 'warning',
            confirmButtonText: '恢复默认',
            cancelButtonText: '取消'
          });
          this.config = normalizeConfig(window.DEFAULT_APP_CONFIG);
          this.collapsedAttachmentMap = {};
          ElMessage.success('已恢复默认配置。');
        } catch (error) {
          // 用户取消，无需处理
        }
      },
      addBaseField() {
        const index = (this.config.baseFields || []).length + 1;
        this.config.baseFields.push({
          sort: index,
          key: `字段${index}`,
          label: `字段${index}`,
          type: 'text',
          required: false,
          placeholder: '请输入'
        });
      },
      removeBaseField(index) {
        this.config.baseFields.splice(index, 1);
      },
      isAttachmentCollapsed(item) {
        if (!item || !item.id) return true;
        return this.collapsedAttachmentMap[item.id] !== false;
      },
      toggleAttachmentCollapse(item) {
        if (!item || !item.id) return;
        this.collapsedAttachmentMap[item.id] = !this.isAttachmentCollapsed(item) ? true : false;
      },
      formatGroupsText(item) {
        const groups = item?.allowedFormatGroups && item.allowedFormatGroups.length
          ? item.allowedFormatGroups
          : extensionsToGroups(item?.allowedExtensions || []);
        if (!groups.length) return '未设置类型';
        return groups.map((value) => {
          const option = FORMAT_GROUPS.find((group) => group.value === value);
          return option ? option.label : value;
        }).join('、');
      },
      addAttachmentItem() {
        const index = (this.config.attachments || []).length + 1;
        const id = `attachment_custom_${Date.now()}`;
        this.config.attachments.push({
          sort: index,
          id,
          code: `附件${String(index).padStart(2, '0')}`,
          name: '新增资料项',
          required: false,
          isTemplate: false,
          allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
          allowedExtensionsText: 'pdf,jpg,jpeg,png',
          allowedFormatGroups: ['pdf', 'image'],
          maxFiles: this.config.limits.defaultMaxFiles || 10,
          maxSizeMB: this.config.limits.defaultMaxSizeMB || 20,
          templateUrl: '',
          exampleImageUrl: '',
          fileNameTemplate: DEFAULT_FILE_NAME_TEMPLATE,
          description: ''
        });
        this.collapsedAttachmentMap[id] = false;
      },
      removeAttachmentItem(index) {
        const removed = this.config.attachments[index];
        this.config.attachments.splice(index, 1);
        if (removed && removed.id) {
          delete this.uploadFiles[removed.id];
        }
      }
    }
  }).use(ElementPlus).mount('#app');
})();
