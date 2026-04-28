const mongoose = require('mongoose');

const branchSettingsSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', unique: true, required: true },
    restaurant: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      subdomain: { type: String, trim: true },
      country: { type: String, trim: true, default: 'Nepal' },
      currency: { type: String, trim: true, default: 'NPR' },
      address: { type: String, trim: true },
      priceField: { type: String, trim: true, default: 'NPR' },
      openingDate: { type: Date },
      types: { type: [String], default: [] },
      profileImageUrl: { type: String, trim: true },
      social: {
        facebook: { type: String, trim: true },
        instagram: { type: String, trim: true },
        tiktok: { type: String, trim: true },
        googleReview: { type: String, trim: true }
      }
    },
    tax: {
      priceRelation: { type: String, enum: ['inclusive', 'exclusive'], default: 'inclusive' },
      legalName: { type: String, trim: true },
      taxNumber: { type: String, trim: true },
      invoiceType: { type: String, trim: true, default: 'Estimate Invoice' },
      contactNumber: { type: String, trim: true },
      address: { type: String, trim: true }
    },
    notifications: {
      newOrderSound: { type: String, trim: true, default: 'default' }
    },
    invoice: {
      invoiceType: { type: String, trim: true, default: 'Estimate Invoice' },
      legalName: { type: String, trim: true },
      contactNumber: { type: String, trim: true },
      taxNumber: { type: String, trim: true },
      address: { type: String, trim: true },
      logoUrl: { type: String, trim: true },
      fontSize: { type: Number, default: 9 },
      showEstimateDetails: { type: Boolean, default: false },
      showInvoiceNo: { type: Boolean, default: true },
      showDate: { type: Boolean, default: true },
      showOrderType: { type: Boolean, default: true },
      showTime: { type: Boolean, default: true },
      showEstimateNumber: { type: Boolean, default: false },
      showItemSN: { type: Boolean, default: true },
      showHSCode: { type: Boolean, default: false },
      showParticular: { type: Boolean, default: true },
      showRate: { type: Boolean, default: true },
      showQty: { type: Boolean, default: true },
      showAmount: { type: Boolean, default: true },
      showItemTotal: { type: Boolean, default: true },
      showSubTotal: { type: Boolean, default: true },
      showDiscount: { type: Boolean, default: true },
      showTaxableAmount: { type: Boolean, default: true },
      showTax: { type: Boolean, default: true },
      showRoundOff: { type: Boolean, default: true },
      showTip: { type: Boolean, default: true },
      showGrandTotal: { type: Boolean, default: true },
      showPaymentMode: { type: Boolean, default: true },
      showBilledBy: { type: Boolean, default: true },
      showKotNumber: { type: Boolean, default: true },
      showAssign: { type: Boolean, default: true },
      showTenderAmount: { type: Boolean, default: true },
      showInWords: { type: Boolean, default: true },
      showServiceDuration: { type: Boolean, default: true },
      qrEnabled: { type: Boolean, default: false },
      qrFileName: { type: String, trim: true },
      qrImageUrl: { type: String, trim: true },
      footer: {
        header: { type: String, trim: true, default: 'Thank You' },
        remarks: { type: String, trim: true, default: 'Thank you for your visit! Visit again' }
      }
    },
    kot: {
      showKotNo: { type: Boolean, default: true },
      showOrderType: { type: Boolean, default: true },
      showTable: { type: Boolean, default: true },
      showOrderBy: { type: Boolean, default: true },
      showTime: { type: Boolean, default: true },
      showItemSN: { type: Boolean, default: true },
      showDishes: { type: Boolean, default: true },
      showQty: { type: Boolean, default: true },
      showTotal: { type: Boolean, default: true },
      fontSize: { type: Number, default: 9 },
      printCount: { type: Number, default: 1 },
      compactView: { type: Boolean, default: false },
      printItemCancellation: { type: Boolean, default: true },
      showKotRemarks: { type: Boolean, default: true },
      showDishRemarks: { type: Boolean, default: true },
      showPrintedBy: { type: Boolean, default: true },
      showPrintedAt: { type: Boolean, default: true },
      footerText: { type: String, trim: true, default: 'Thank You!' },
      dishRemarksPosition: { type: String, enum: ['footer', 'below_dish'], default: 'footer' },
      primaryButton: { type: String, enum: ['confirm', 'confirm_print'], default: 'confirm' },
      autoResetKot: { type: Boolean, default: false }
    },
    printer: {
      mode: { type: String, enum: ['local', 'cloud'], default: 'local' },
      autoPrintBill: { type: Boolean, default: false },
      autoPrintFullKot: { type: Boolean, default: false },
      directPrinting: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BranchSettings', branchSettingsSchema);
