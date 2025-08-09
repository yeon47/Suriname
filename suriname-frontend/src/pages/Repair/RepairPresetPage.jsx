import React, { useState, useEffect, useMemo } from 'react';
import SidebarNavigation from '../../components/SidebarNavigation';
import { getCategories } from '../../api/category';
import { createRepairPreset } from '../../api/repairPreset';
import styles from '../../css/Repair/RepairPreset.module.css';

const FALLBACK_CATEGORIES = [
  { categoryId: 100, name: '모바일', parentId: null },
  { categoryId: 101, name: '스마트폰', parentId: 100 },
  { categoryId: 102, name: '태블릿', parentId: 100 },
  { categoryId: 200, name: '가전제품', parentId: null },
  { categoryId: 201, name: '냉장고', parentId: 200 },
  { categoryId: 202, name: '세탁기', parentId: 200 },
  { categoryId: 203, name: '에어컨', parentId: 200 },
];

const LS_KEY = 'repairPresetDupSet';
const normalize = (s = '') => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const dupKey = (categoryId, name) => `${categoryId}::${normalize(name)}`;

const RepairPresetPage = () => {
  const [formData, setFormData] = useState({
    categoryId: '',
    name: '',
    description: '',
    cost: ''
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [errors, setErrors] = useState({
    categoryId: '',
    name: '',
    cost: ''
  });

  const [dupSet, setDupSet] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(arr);
    } catch {
      return new Set();
    }
  });
  const persistDupSet = (setVal) =>
    localStorage.setItem(LS_KEY, JSON.stringify(Array.from(setVal)));

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await getCategories();
      const data = Array.isArray(res?.data) ? res.data : [];
      const sorted = [...data].sort((a, b) => {
        if (!a.parentId && !b.parentId) return 0;
        if (!a.parentId) return -1;
        if (!b.parentId) return 1;
        return a.parentId - b.parentId;
      });
      setCategories(sorted.length ? sorted : FALLBACK_CATEGORIES);
    } catch (e) {
      console.error('카테고리 로드 실패:', e);
      setCategories(FALLBACK_CATEGORIES);
    } finally {
      setLoading(false);
    }
  };

  const validateField = (field, value) => {
    switch (field) {
      case 'categoryId': {
        if (!value) return '카테고리를 선택해주세요.';
        const num = parseInt(value, 10);
        if (Number.isNaN(num)) return '카테고리를 올바르게 선택해주세요.';
        return '';
      }
      case 'name': {
        if (!value || !value.trim()) return '프리셋 이름을 입력해주세요.';
        if (value.trim().length > 100) return '프리셋 이름은 100자 이하여야 합니다.';
        return '';
      }
      case 'cost': {
        if (value === '' || value === null || value === undefined) return '비용을 입력해주세요.';
        const num = Number(value);
        if (!Number.isFinite(num)) return '비용은 숫자여야 합니다.';
        if (num < 0) return '비용은 0 이상이어야 합니다.';
        if (!Number.isInteger(num)) return '비용은 정수여야 합니다.';
        return '';
      }
      default:
        return '';
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (['categoryId', 'name', 'cost'].includes(field)) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const isFormValid = useMemo(() => {
    const fieldsToCheck = ['categoryId', 'name', 'cost'];
    const newErrors = fieldsToCheck.reduce((acc, f) => {
      const err = validateField(f, formData[f]);
      if (err) acc[f] = err;
      return acc;
    }, {});
    if (Object.keys(newErrors).length) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
    }
    return Object.keys(newErrors).length === 0;
  }, [formData.categoryId, formData.name, formData.cost]);

  const setErrorMsg = (text) => setMessage({ type: 'error', text });
  const setSuccessMsg = (text) => setMessage({ type: 'success', text });

  const currentKey = useMemo(
    () =>
      formData.categoryId && formData.name
        ? dupKey(formData.categoryId, formData.name)
        : '',
    [formData.categoryId, formData.name]
  );
  const isDuplicate = useMemo(() => !!currentKey && dupSet.has(currentKey), [currentKey, dupSet]);

  const handleSubmit = async () => {
    if (loading) return;
    setMessage({ type: '', text: '' });

    const categoryIdErr = validateField('categoryId', formData.categoryId);
    const nameErr = validateField('name', formData.name);
    const costErr = validateField('cost', formData.cost);

    const nextErrors = { categoryId: categoryIdErr, name: nameErr, cost: costErr };
    setErrors(nextErrors);

    if (categoryIdErr || nameErr || costErr) {
      setErrorMsg('입력값을 확인해주세요.');
      return;
    }

    if (isDuplicate) {
      setErrorMsg('동일 카테고리에 같은 이름의 프리셋이 이미 있습니다.');
      return;
    }

    const payload = {
      categoryId: parseInt(formData.categoryId, 10),
      name: formData.name.trim(),
      description: formData.description?.trim() || '',
      cost: parseInt(formData.cost, 10)
    };

    try {
      setLoading(true);
      await createRepairPreset(payload);

      if (currentKey) {
        const next = new Set(dupSet);
        next.add(currentKey);
        setDupSet(next);
        persistDupSet(next);
      }

      setSuccessMsg('등록 성공');
      setFormData({ categoryId: '', name: '', description: '', cost: '' });
      setErrors({ categoryId: '', name: '', cost: '' });
    } catch (err) {
      console.error('프리셋 등록 실패:', err);
      setErrorMsg('등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (loading) return;
    setMessage({ type: '', text: '' });
    setErrors({ categoryId: '', name: '', cost: '' });
    setFormData({ categoryId: '', name: '', description: '', cost: '' });
  };

  useEffect(() => {
    if (message.type === 'success' && message.text) {
      const t = setTimeout(() => setMessage({ type: '', text: '' }), 2500);
      return () => clearTimeout(t);
    }
  }, [message.type, message.text]);

  return (
    <div className={styles.customerContainer}>
      <SidebarNavigation />

      <div className={styles.tabNavigation}>
        <div className={styles.tabContainer}>
          <button className={`${styles.tabButton} ${styles.active}`}>프리셋 등록</button>
        </div>
      </div>

      <div className={styles.sectionContainer}>
        <div className={styles.sectionContent}>
          <h2 className={styles.sectionTitle}>제품 카테고리</h2>
          <div className={styles.inputGroup}>
            <div className={styles.inputField} style={{ width: '100%' }}>
              <select
                className={styles.inputControl}
                value={formData.categoryId}
                onChange={(e) => handleInputChange('categoryId', e.target.value)}
                disabled={loading}
              >
                <option value="">카테고리 선택</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={String(c.categoryId)}>
                    {c.parentId ? c.name : `--- ${c.name} ---`}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <small style={{ color: '#dc2626', marginTop: 6 }}>{errors.categoryId}</small>
              )}
            </div>
          </div>
        </div>

        <div className={styles.sectionContent}>
          <h2 className={styles.sectionTitle}>프리셋 이름</h2>
          <div className={styles.inputGroup}>
            <div className={styles.inputField} style={{ width: '100%' }}>
              <input
                type="text"
                className={styles.inputControl}
                placeholder="입력"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={loading}
                maxLength={100}
              />
              {errors.name && (
                <small style={{ color: '#dc2626', marginTop: 6 }}>{errors.name}</small>
              )}
              {isDuplicate && !errors.name && formData.name?.trim() && formData.categoryId && (
                <small style={{ color: '#dc2626', marginTop: 6 }}>
                  동일 카테고리에 같은 이름의 프리셋이 이미 있습니다.
                </small>
              )}
            </div>
          </div>
        </div>

        <div className={styles.sectionContent}>
          <h2 className={styles.sectionTitle}>설명</h2>
          <div className={styles.inputGroup}>
            <div className={styles.inputField} style={{ width: '100%' }}>
              <input
                type="text"
                className={styles.inputControl}
                placeholder="입력"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className={styles.sectionContent}>
          <h2 className={styles.sectionTitle}>비용 입력</h2>
        <div className={styles.inputGroup}>
            <div className={styles.inputField} style={{ width: '300px' }}>
              <input
                type="number"
                className={styles.inputControl}
                placeholder="입력"
                value={formData.cost}
                onChange={(e) => handleInputChange('cost', e.target.value)}
                min="0"
                step="1"
                disabled={loading}
              />
              {errors.cost && (
                <small style={{ color: '#dc2626', marginTop: 6 }}>{errors.cost}</small>
              )}
            </div>
          </div>
        </div>

        {message.text && (
          <div
            role="status"
            aria-live="polite"
            style={{
              width: '100%',
              maxWidth: 600,
              margin: '0 auto 12px auto',
              padding: '8px 10px',
              borderRadius: 6,
              border: message.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0',
              background: message.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: message.type === 'error' ? '#991b1b' : '#166534',
              fontSize: 14,
              textAlign: 'center'
            }}
          >
            {message.text}
          </div>
        )}

        <div className={styles.buttonGroup}>
          <button className={styles.cancelButton} onClick={handleCancel} disabled={loading}>
            취소
          </button>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={loading || !isFormValid || isDuplicate}
            title="등록"
          >
            {loading ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepairPresetPage;
