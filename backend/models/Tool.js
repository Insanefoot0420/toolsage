/**
 * Tool data model - matches Firestore schema from ToolSage documentation
 */
class Tool {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.description = data.description || '';
    this.categories = data.categories || [];
    this.tags = data.tags || [];
    this.usage_examples = data.usage_examples || [];
    this.links = data.links || [];
    this.setup_guides = data.setup_guides || '';
    this.compatibility = {
      os: data.compatibility?.os || [],
      platforms: data.compatibility?.platforms || [],
      architectures: data.compatibility?.architectures || []
    };
    this.pricing_model = data.pricing_model || 'free';
    this.alternatives = data.alternatives || [];
    this.average_rating = data.average_rating || 0;
    this.review_count = data.review_count || 0;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
    this.created_by = data.created_by || '';
    this.status = data.status || 'published';
  }

  generateId() {
    const chars = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 32; i++) {
      id += chars[Math.floor(Math.random() * 16)];
    }
    return `${id.substring(0,8)}-${id.substring(8,12)}-${id.substring(12,16)}-${id.substring(16,20)}-${id.substring(20)}`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      categories: this.categories,
      tags: this.tags,
      usage_examples: this.usage_examples,
      links: this.links,
      setup_guides: this.setup_guides,
      compatibility: this.compatibility,
      pricing_model: this.pricing_model,
      alternatives: this.alternatives,
      average_rating: this.average_rating,
      review_count: this.review_count,
      created_at: this.created_at,
      updated_at: this.updated_at,
      created_by: this.created_by,
      status: this.status
    };
  }

  static fromJSON(json) {
    return new Tool(json);
  }

  validate() {
    const errors = [];
    if (!this.name || this.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Název nástroje je povinný' });
    }
    if (this.average_rating !== undefined && (this.average_rating < 0 || this.average_rating > 5)) {
      errors.push({ field: 'average_rating', message: 'Hodnocení musí být 0-5' });
    }
    const validStatuses = ['published', 'draft', 'pending_review'];
    if (this.status && !validStatuses.includes(this.status)) {
      errors.push({ field: 'status', message: `Neplatný status. Použij: ${validStatuses.join(', ')}` });
    }
    return errors;
  }
}

module.exports = { Tool };
