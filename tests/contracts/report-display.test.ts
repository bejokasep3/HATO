import assert from 'node:assert/strict'
import test from 'node:test'
import { reportCurrency, reportNumber, reportPercent, reportCsvCell } from '../../shared/report-display'

test('reports distinguish unknown values from confirmed zero in screens and exports', () => {
  assert.equal(reportNumber(null), 'Belum diketahui')
  assert.equal(reportNumber(0), 0)
  assert.equal(reportCurrency(null), 'Belum diketahui')
  assert.match(reportCurrency(0), /0/)
  assert.equal(reportPercent(null), 'Belum diketahui')
  assert.equal(reportPercent(0), '0%')
  assert.equal(reportCsvCell(null), '"Belum diketahui"')
})

test('CSV keeps names in one cell and neutralizes spreadsheet formulas', () => {
  assert.equal(reportCsvCell('Nama, "anggota"\nbaru'), '"Nama, ""anggota""\nbaru"')
  assert.equal(reportCsvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"')
  assert.equal(reportCsvCell(-1500), '"-1500"')
})
