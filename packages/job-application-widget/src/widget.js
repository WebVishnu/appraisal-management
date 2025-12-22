(function(window) {
  'use strict';

  class JobApplicationWidget {
    constructor(options) {
      this.apiUrl = options.apiUrl || (window.location.origin + '/api/public/jobs');
      this.token = options.token;
      this.container = typeof options.container === 'string' 
        ? document.querySelector(options.container) 
        : options.container;
      this.jobData = null;
      
      // Show loading state
      if (this.container) {
        this.container.innerHTML = '<div class="hrms-widget"><div class="hrms-loading">Loading job details...</div></div>';
      }
      
      this.init().catch(error => {
        console.error('Widget initialization error:', error);
        if (this.container) {
          this.showError(error.message || 'Failed to initialize widget. Please check the token and try again.');
        }
      });
    }

    async init() {
      if (!this.token) {
        const error = 'Job token is required. Please provide a valid token.';
        this.showError(error);
        throw new Error(error);
      }

      if (!this.container) {
        const error = 'Container element is required';
        throw new Error(error);
      }

      // Load job data
      const loaded = await this.loadJobData();
      
      if (loaded) {
        // Render widget
        this.render();
      }
    }

    async loadJobData() {
      try {
        const url = `${this.apiUrl}/${this.token}`;
        console.log('Loading job data from:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
          const errorMsg = data.error || 'Failed to load job details';
          console.error('API Error:', errorMsg);
          this.showError(errorMsg);
          return false;
        }
        
        this.jobData = data;
        console.log('Job data loaded:', this.jobData);
        return true;
      } catch (error) {
        console.error('Error loading job data:', error);
        this.showError(error.message || 'Failed to load job details. Please check your connection and try again.');
        return false;
      }
    }

    render() {
      if (!this.jobData) {
        console.error('Cannot render widget: jobData is missing');
        this.showError('Job data is missing. Please check the token and try again.');
        return;
      }

      this.container.innerHTML = `
        <div id="hrms-job-widget" class="hrms-widget">
          <div class="hrms-widget-header">
            <h3>${this.escapeHtml(this.jobData.jobTitle || 'Job Application')}</h3>
            <p class="hrms-location">📍 ${this.escapeHtml(this.jobData.location || '')} | ${this.escapeHtml(this.jobData.department || '')}</p>
          </div>
          
          <div class="hrms-widget-body">
            ${this.jobData.description ? `
            <div class="hrms-job-description">
              <h4>Job Description</h4>
              <div class="hrms-description-text">${this.formatDescription(this.jobData.description)}</div>
            </div>
            ` : ''}

            ${this.jobData.requirements ? `
            <div class="hrms-job-requirements">
              <h4>Requirements</h4>
              <div class="hrms-requirements-text">${this.formatDescription(this.jobData.requirements)}</div>
            </div>
            ` : ''}

            <form id="hrms-application-form" class="hrms-form">
              <div class="hrms-form-row">
                <div class="hrms-form-group">
                  <label>First Name *</label>
                  <input type="text" name="firstName" required>
                </div>
                <div class="hrms-form-group">
                  <label>Last Name *</label>
                  <input type="text" name="lastName" required>
                </div>
              </div>

              <div class="hrms-form-group">
                <label>Email *</label>
                <input type="email" name="email" required>
              </div>

              <div class="hrms-form-group">
                <label>Phone Number *</label>
                <input type="tel" name="phoneNumber" required>
              </div>

              <div class="hrms-form-group">
                <label>Resume *</label>
                <input type="file" name="resume" accept=".pdf,.doc,.docx" required>
                <small>PDF, DOC, or DOCX (Max 5MB)</small>
              </div>

              <div class="hrms-form-group">
                <label>LinkedIn Profile</label>
                <input type="url" name="linkedinUrl" placeholder="https://linkedin.com/in/...">
              </div>

              <div class="hrms-form-group">
                <label>Portfolio/Website</label>
                <input type="url" name="portfolioUrl" placeholder="https://yourportfolio.com">
              </div>

              <div class="hrms-form-row">
                <div class="hrms-form-group">
                  <label>Current Company</label>
                  <input type="text" name="currentCompany">
                </div>
                <div class="hrms-form-group">
                  <label>Years of Experience</label>
                  <input type="number" name="totalExperience" min="0" step="0.5">
                </div>
              </div>

              <div class="hrms-form-group">
                <label>Notice Period (days)</label>
                <input type="number" name="noticePeriod" min="0" value="0">
              </div>

              <button type="submit" class="hrms-submit-btn">Submit Application</button>
              
              <div id="hrms-message" class="hrms-message"></div>
            </form>
          </div>
        </div>
      `;

      // Attach form handler
      const form = document.getElementById('hrms-application-form');
      form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    async handleSubmit(e) {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      const messageDiv = document.getElementById('hrms-message');
      
      // Disable submit button
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      messageDiv.innerHTML = '';
      messageDiv.className = 'hrms-message';

      // Collect form data
      const formData = new FormData(form);
      const resumeFile = formData.get('resume');

      // Validate file size
      if (resumeFile && resumeFile.size > 5 * 1024 * 1024) {
        messageDiv.className = 'hrms-message hrms-error';
        messageDiv.innerHTML = '❌ Resume file size must be less than 5MB';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
        return;
      }

      // Convert file to base64 if file uploaded
      let resumeBase64 = null;
      if (resumeFile && resumeFile.size > 0) {
        try {
          resumeBase64 = await this.fileToBase64(resumeFile);
        } catch (error) {
          messageDiv.className = 'hrms-message hrms-error';
          messageDiv.innerHTML = '❌ Failed to read resume file';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Application';
          return;
        }
      }

      const applicationData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phoneNumber: formData.get('phoneNumber'),
        resume: resumeBase64,
        linkedinUrl: formData.get('linkedinUrl') || undefined,
        portfolioUrl: formData.get('portfolioUrl') || undefined,
        currentCompany: formData.get('currentCompany') || undefined,
        totalExperience: formData.get('totalExperience') ? 
          parseFloat(formData.get('totalExperience')) : undefined,
        noticePeriod: formData.get('noticePeriod') ? 
          parseInt(formData.get('noticePeriod')) : 0,
        source: 'career_page',
      };

      try {
        const response = await fetch(`${this.apiUrl}/${this.token}/apply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(applicationData),
        });

        const result = await response.json();

        if (response.ok) {
          messageDiv.className = 'hrms-message hrms-success';
          messageDiv.innerHTML = '✅ Application submitted successfully! We will get back to you soon.';
          form.reset();
        } else {
          messageDiv.className = 'hrms-message hrms-error';
          messageDiv.innerHTML = `❌ ${result.error || 'Failed to submit application'}`;
        }
      } catch (error) {
        messageDiv.className = 'hrms-message hrms-error';
        messageDiv.innerHTML = '❌ Network error. Please try again.';
        console.error('Error submitting application:', error);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
      }
    }

    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    formatDescription(text) {
      if (!text) return '';
      // Convert line breaks to <br>
      const escaped = this.escapeHtml(text);
      return escaped.replace(/\n/g, '<br>');
    }

    showError(message) {
      this.container.innerHTML = `
        <div class="hrms-widget">
          <div class="hrms-message hrms-error">${this.escapeHtml(message)}</div>
        </div>
      `;
    }
  }

  // Export for use
  window.JobApplicationWidget = JobApplicationWidget;

  // Auto-initialize if data attributes are present
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initializeWidgets();
    });
  } else {
    initializeWidgets();
  }

  function initializeWidgets() {
    const widgetElements = document.querySelectorAll('[data-hrms-job-widget]');
    console.log('Found', widgetElements.length, 'widget elements');
    
    widgetElements.forEach(function(widgetElement) {
      const token = widgetElement.getAttribute('data-job-token');
      const apiUrl = widgetElement.getAttribute('data-api-url') || (window.location.origin + '/api/public/jobs');
      
      console.log('Initializing widget with token:', token, 'apiUrl:', apiUrl);
      
      if (token && token !== 'YOUR_JOB_PUBLIC_TOKEN') {
        try {
          new JobApplicationWidget({
            token: token,
            apiUrl: apiUrl,
            container: widgetElement,
          });
        } catch (error) {
          console.error('Error initializing widget:', error);
          widgetElement.innerHTML = '<div class="hrms-widget"><div class="hrms-message hrms-error">Failed to initialize widget. Please check the console for details.</div></div>';
        }
      } else {
        console.warn('Widget token not set or using placeholder. Please provide a valid token.');
        widgetElement.innerHTML = '<div class="hrms-widget"><div class="hrms-message hrms-error">Please set a valid job token. Replace YOUR_JOB_PUBLIC_TOKEN with a real token from the HRMS dashboard.</div></div>';
      }
    });
  }

})(window);

